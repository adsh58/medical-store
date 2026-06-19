from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
import uuid

from app.database import get_db
from app.schemas.all_schemas import StoreCreate, StoreResponse, StoreAdminCreate, UserResponse
from app.core.dependencies import RoleChecker
from app.models.all_models import User, Store, Role
from app.repositories.all_repos import store_repo, user_repo, role_repo
from app.core.exceptions import NotFoundException, BadRequestException
from app.core.security import hash_password

router = APIRouter(prefix="/stores", tags=["Stores"])

# Enforce SUPER_ADMIN role for all store operations
super_admin_check = RoleChecker(["SUPER_ADMIN"])

@router.post("", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
async def create_store(
    store_in: StoreCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(super_admin_check)
):
    """
    Create a new medical store registry (SUPER_ADMIN only).
    """
    # Check if store email already exists
    if store_in.email:
        existing = await store_repo.get_by_email(db, store_in.email)
        if existing:
            raise BadRequestException("Store with this email already exists")
            
    store = await store_repo.create(db, obj_in=store_in.model_dump())
    await db.commit()
    return store

@router.get("", response_model=List[StoreResponse])
async def list_stores(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(super_admin_check)
):
    """
    List all medical stores inside the platform database (SUPER_ADMIN only).
    """
    return await store_repo.get_multi(db)

@router.get("/{id}", response_model=StoreResponse)
async def get_store(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(super_admin_check)
):
    """
    Retrieve specific store details (SUPER_ADMIN only).
    """
    store = await store_repo.get(db, id)
    if not store:
        raise NotFoundException("Store not found")
    return store

@router.put("/{id}", response_model=StoreResponse)
async def update_store(
    id: uuid.UUID,
    store_in: StoreCreate,
    active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(super_admin_check)
):
    """
    Update store configuration details and toggle active/inactive status (SUPER_ADMIN only).
    """
    store = await store_repo.get(db, id)
    if not store:
        raise NotFoundException("Store not found")
        
    update_data = store_in.model_dump(exclude_unset=True)
    if active is not None:
        update_data["active"] = active
        
    updated = await store_repo.update(db, db_obj=store, obj_in=update_data)
    await db.commit()
    return updated

@router.delete("/{id}")
async def delete_store(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(super_admin_check)
):
    """
    Remove store from the database (SUPER_ADMIN only).
    """
    store = await store_repo.get(db, id)
    if not store:
        raise NotFoundException("Store not found")
        
    await store_repo.remove(db, id=id)
    await db.commit()
    return {"success": True, "message": "Store deleted successfully"}

@router.post("/admin", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_store_admin(
    admin_in: StoreAdminCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(super_admin_check)
):
    """
    Create a new ADMIN user for a medical store (SUPER_ADMIN only).
    """
    # Verify store exists
    store = await store_repo.get(db, admin_in.store_id)
    if not store:
        raise NotFoundException("Store not found")
        
    # Check if user email exists
    existing = await user_repo.get_by_email(db, admin_in.email)
    if existing:
        raise BadRequestException("User with this email already exists")
        
    # Retrieve ADMIN role
    role = await role_repo.get_by_name(db, "ADMIN")
    if not role:
        role = await role_repo.create(db, obj_in={"name": "ADMIN", "description": "Store Administrator Role"})
        
    user_data = {
        "email": admin_in.email,
        "password_hash": hash_password(admin_in.password),
        "full_name": admin_in.full_name,
        "role_id": role.id,
        "store_id": admin_in.store_id,
        "is_active": True
    }
    user = await user_repo.create(db, obj_in=user_data)
    await db.commit()
    return await user_repo.get(db, user.id)

@router.put("/{id}/reset-admin-password")
async def reset_store_admin_password(
    id: uuid.UUID,  # Store ID
    new_password: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(super_admin_check)
):
    """
    Change the admin password of the specified medical store (SUPER_ADMIN only).
    """
    # 1. Fetch store
    store = await store_repo.get(db, id)
    if not store:
        raise NotFoundException("Store not found")
        
    # 2. Find store admin user
    from sqlalchemy.orm import selectinload
    query = select(User).join(Role).filter(
        User.store_id == id,
        Role.name == "ADMIN",
        User.deleted_at == None
    )
    res = await db.execute(query)
    admin_user = res.scalars().first()
    
    if not admin_user:
        raise NotFoundException("Administrator user not found for this store")
        
    # 3. Update password
    updated_data = {"password_hash": hash_password(new_password)}
    await user_repo.update(db, db_obj=admin_user, obj_in=updated_data)
    await db.commit()
    return {"success": True, "message": f"Admin password reset successfully for store '{store.name}'"}
