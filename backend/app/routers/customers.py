from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from app.database import get_db
from app.schemas.all_schemas import CustomerCreate, CustomerResponse
from app.services.all_services import customer_service
from app.repositories.all_repos import customer_repo
from app.core.dependencies import RoleChecker, get_current_user
from app.models.all_models import User
from app.core.exceptions import NotFoundException, BadRequestException

router = APIRouter(prefix="/customers", tags=["Customer Management"])

@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer_in: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER", "CASHIER"]))
):
    """
    Register a new customer in the store.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    cust = await customer_service.create_customer(db, customer_in, store_id=current_user.store_id, user_id=current_user.id)
    await db.commit()
    return cust

@router.get("/", response_model=List[CustomerResponse])
async def list_customers(
    search: Optional[str] = Query(None, description="Search term for name or phone number"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER", "CASHIER"]))
):
    """
    Retrieve registered customers for the current user's store.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    if search:
        return await customer_repo.search(db, search, store_id=current_user.store_id, limit=100)
    return await customer_repo.get_multi(db, limit=100, store_id=current_user.store_id)

@router.get("/search", response_model=List[CustomerResponse])
async def search_customers(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER", "CASHIER"]))
):
    """
    Search customers by name or mobile number in the current user's store.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    return await customer_repo.search(db, q, store_id=current_user.store_id, limit=10)

@router.put("/{id}", response_model=CustomerResponse)
async def update_customer(
    id: uuid.UUID,
    customer_in: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER", "CASHIER"]))
):
    """
    Update customer details in the current user's store.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    cust = await customer_service.update_customer(db, id, customer_in, store_id=current_user.store_id, user_id=current_user.id)
    await db.commit()
    return cust

@router.delete("/{id}")
async def delete_customer(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Delete customer profile.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    cust = await customer_repo.get(db, id, store_id=current_user.store_id)
    if not cust:
        raise NotFoundException("Customer not found")
        
    await customer_repo.remove(db, id=id, store_id=current_user.store_id)
    await db.commit()
    return {"success": True, "message": "Customer deleted successfully"}
