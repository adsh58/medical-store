from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from app.database import get_db
from app.schemas.all_schemas import CustomerCreate, CustomerResponse
from app.services.all_services import customer_service
from app.repositories.all_repos import customer_repo
from app.core.dependencies import RoleChecker

router = APIRouter(prefix="/customers", tags=["Customer Management"])

@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer_in: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER", "CASHIER"]))
):
    """
    Register a new customer.
    """
    cust = await customer_service.create_customer(db, customer_in)
    await db.commit()
    return cust

@router.get("/", response_model=List[CustomerResponse])
async def list_customers(
    search: Optional[str] = Query(None, description="Search term for name or phone number"),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve registered customers.
    """
    if search:
        return await customer_repo.search(db, search, limit=100)
    return await customer_repo.get_multi(db, limit=100)

@router.get("/search", response_model=List[CustomerResponse])
async def search_customers(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db)
):
    """
    Search customers by name or mobile number.
    """
    return await customer_repo.search(db, q, limit=10)

@router.put("/{id}", response_model=CustomerResponse)
async def update_customer(
    id: uuid.UUID,
    customer_in: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER", "CASHIER"]))
):
    """
    Update customer details.
    """
    cust = await customer_service.update_customer(db, id, customer_in)
    await db.commit()
    return cust

@router.delete("/{id}")
async def delete_customer(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Delete customer profile.
    """
    from app.core.exceptions import NotFoundException
    cust = await customer_repo.get(db, id)
    if not cust:
        raise NotFoundException("Customer not found")
    await customer_repo.remove(db, id=id)
    await db.commit()
    return {"success": True, "message": "Customer deleted successfully"}
