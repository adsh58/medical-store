from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import uuid

from app.database import get_db
from app.schemas.all_schemas import SaleCreate, SaleResponse
from app.services.all_services import sales_service
from app.repositories.all_repos import sales_repo
from app.core.dependencies import RoleChecker, get_current_user
from app.models.all_models import User
from app.core.exceptions import NotFoundException

router = APIRouter(prefix="/sales", tags=["Sales Management"])

@router.post("/", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(
    sale_in: SaleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER", "CASHIER"]))
):
    """
    Record a new customer sale registry. Decrements stock levels across all included batches.
    """
    sale = await sales_service.create_sale(db, current_user.id, sale_in)
    await db.commit()
    
    # Reload with items relation
    from sqlalchemy.orm import selectinload
    from sqlalchemy.future import select
    from app.models.all_models import Sales, SaleItem, Batch, MedicineLocationMapping, Box, Shelf, Rack
    query = select(Sales).filter(Sales.id == sale.id).options(
        selectinload(Sales.items).selectinload(SaleItem.batch).selectinload(Batch.medicine),
        selectinload(Sales.items).selectinload(SaleItem.batch).selectinload(Batch.location_mapping).selectinload(MedicineLocationMapping.box).selectinload(Box.shelf).selectinload(Shelf.rack)
    )
    res = await db.execute(query)
    return res.scalars().first()

@router.get("/", response_model=List[SaleResponse])
async def list_sales(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve paginated lists of recorded sales transactions.
    """
    from sqlalchemy.orm import selectinload
    from sqlalchemy.future import select
    from app.models.all_models import Sales, SaleItem, Batch, MedicineLocationMapping, Box, Shelf, Rack
    query = select(Sales).offset(skip).limit(limit).options(
        selectinload(Sales.items).selectinload(SaleItem.batch).selectinload(Batch.medicine),
        selectinload(Sales.items).selectinload(SaleItem.batch).selectinload(Batch.location_mapping).selectinload(MedicineLocationMapping.box).selectinload(Box.shelf).selectinload(Shelf.rack)
    )
    res = await db.execute(query)
    return list(res.scalars().all())

@router.get("/{id}", response_model=SaleResponse)
async def get_sale(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Fetch a detailed sales transaction record by UUID.
    """
    from sqlalchemy.orm import selectinload
    from sqlalchemy.future import select
    from app.models.all_models import Sales, SaleItem, Batch, MedicineLocationMapping, Box, Shelf, Rack
    query = select(Sales).filter(Sales.id == id).options(
        selectinload(Sales.items).selectinload(SaleItem.batch).selectinload(Batch.medicine),
        selectinload(Sales.items).selectinload(SaleItem.batch).selectinload(Batch.location_mapping).selectinload(MedicineLocationMapping.box).selectinload(Box.shelf).selectinload(Shelf.rack)
    )
    res = await db.execute(query)
    sale = res.scalars().first()
    if not sale:
        raise NotFoundException("Sales record not found")
    return sale
