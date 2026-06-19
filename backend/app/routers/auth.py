from fastapi import APIRouter, Depends, status, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from app.database import get_db
from app.schemas.all_schemas import UserCreate, UserLogin, Token, UserResponse, UserUpdate
from app.services.all_services import auth_service
from app.core.dependencies import get_current_user, RoleChecker
from app.models.all_models import User, Role
from app.repositories.all_repos import user_repo, doctor_repo
from app.core.exceptions import NotFoundException, BadRequestException

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "SUPER_ADMIN"]))
):
    """
    Register a new user inside the system. Enforces role and store configuration.
    """
    # ADMIN users can only register users for their own store
    store_id = current_user.store_id
    if current_user.role.name == "SUPER_ADMIN":
        # Super admin has no store_id, unless they register a store user via store router
        store_id = None
        
    user = await auth_service.register_user(db, user_in, store_id=store_id)
    await db.commit()
    return await user_repo.get(db, user.id)

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Authenticate email credentials and return JWT authorization token pair.
    """
    token = await auth_service.authenticate_user(db, credentials)
    return token

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Retrieve user metadata based on active request JWT claims.
    """
    return current_user

@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token_in: str = Header(..., alias="Authorization"),
    db: AsyncSession = Depends(get_db)
):
    """
    Exchange refresh token for a new set of access/refresh JWT tokens.
    """
    if refresh_token_in.startswith("Bearer "):
        token = refresh_token_in.split(" ")[1]
    else:
        token = refresh_token_in
        
    from app.core.security import verify_refresh_token, create_access_token, create_refresh_token
    from app.core.exceptions import UnauthorizedException
    
    payload = verify_refresh_token(token)
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise UnauthorizedException("Invalid refresh token")
        
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise UnauthorizedException("Invalid refresh token format")
        
    user = await user_repo.get(db, user_id)
    if not user or not user.is_active:
        raise UnauthorizedException("User inactive or deleted")
        
    new_access = create_access_token({"sub": str(user.id), "role": user.role.name})
    new_refresh = create_refresh_token({"sub": str(user.id), "role": user.role.name})
    
    return Token(access_token=new_access, refresh_token=new_refresh)


# ==========================================
# BACKWARD COMPATIBILITY DOCTOR ENDPOINTS
# ==========================================
@router.get("/doctors")
async def list_doctors_legacy(
    search: Optional[str] = Query(None, description="Search doctors by name or email"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Legacy endpoint redirecting to the Doctor business entity registry.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    if search:
        docs = await doctor_repo.search(db, search, store_id=current_user.store_id)
    else:
        docs = await doctor_repo.get_multi(db, store_id=current_user.store_id)
        
    res_data = []
    for d in docs:
        res_data.append({
            "id": str(d.id),
            "email": d.clinic_name or "noemail@mail.com",
            "full_name": d.name,
            "is_active": d.active,
            "role": {"id": str(uuid.uuid4()), "name": "DOCTOR", "description": "Doctor"},
            "created_at": d.created_at.isoformat()
        })
    return res_data

@router.post("/doctors", status_code=status.HTTP_201_CREATED)
async def create_doctor_legacy(
    doctor_in: UserCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Legacy endpoint mapping to new Doctor business entity creation.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    doc = await doctor_repo.create(db, obj_in={
        "store_id": current_user.store_id,
        "name": doctor_in.full_name,
        "mobile": "0000000000",
        "clinic_name": doctor_in.email,
        "address": "Created from legacy endpoint",
        "active": True,
        "created_by_user_id": current_user.id,
        "updated_by_user_id": current_user.id
    })
    await db.commit()
    return {
        "id": str(doc.id),
        "email": doc.clinic_name,
        "full_name": doc.name,
        "is_active": doc.active,
        "role": {"id": str(uuid.uuid4()), "name": "DOCTOR", "description": "Doctor"},
        "created_at": doc.created_at.isoformat()
    }

@router.put("/doctors/{id}")
async def update_doctor_legacy(
    id: uuid.UUID,
    doctor_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Legacy endpoint mapping to Doctor business entity updates.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    doc = await doctor_repo.get(db, id, store_id=current_user.store_id)
    if not doc:
        raise NotFoundException("Doctor not found")
        
    doc.name = doctor_in.full_name
    doc.clinic_name = doctor_in.email
    doc.updated_by_user_id = current_user.id
    
    db.add(doc)
    await db.commit()
    return {
        "id": str(doc.id),
        "email": doc.clinic_name,
        "full_name": doc.name,
        "is_active": doc.active,
        "role": {"id": str(uuid.uuid4()), "name": "DOCTOR", "description": "Doctor"},
        "created_at": doc.created_at.isoformat()
    }

@router.delete("/doctors/{id}")
async def delete_doctor_legacy(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Legacy endpoint mapping to Doctor soft deletion.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    doc = await doctor_repo.get(db, id, store_id=current_user.store_id)
    if not doc:
        raise NotFoundException("Doctor not found")
        
    await doctor_repo.remove(db, id=id, store_id=current_user.store_id)
    await db.commit()
    return {"success": True, "message": "Doctor deleted successfully"}
