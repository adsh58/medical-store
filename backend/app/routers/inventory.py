from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from app.database import get_db
from app.schemas.all_schemas import StockResponse, BatchResponse, StockAdjustmentRequest, StockMovementResponse
from app.repositories.all_repos import stock_repo, batch_repo, stock_movement_repo
from app.services.all_services import inventory_service
from app.core.dependencies import get_current_user, RoleChecker
from app.models.all_models import User
from app.core.exceptions import NotFoundException, BadRequestException

router = APIRouter(prefix="/inventory", tags=["Inventory Management"])

@router.get("/stock", response_model=List[StockResponse])
async def list_stock(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch current stock levels for all medicine batches in the store.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    from sqlalchemy.orm import selectinload
    from sqlalchemy.future import select
    from app.models.all_models import Stock, Batch, MedicineLocationMapping, Box, Shelf, Rack
    
    query = select(Stock).filter(
        Stock.deleted_at == None,
        Stock.store_id == current_user.store_id
    ).offset(skip).limit(limit).options(
        selectinload(Stock.batch).selectinload(Batch.medicine),
        selectinload(Stock.batch).selectinload(Batch.location_mapping).selectinload(MedicineLocationMapping.box).selectinload(Box.shelf).selectinload(Shelf.rack)
    )
    res = await db.execute(query)
    return list(res.scalars().all())

@router.get("/stock/low", response_model=List[StockResponse])
async def list_low_stock(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Identify stock batches running below their reorder threshold level.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    return await stock_repo.get_low_stock(db, store_id=current_user.store_id)

@router.get("/batches", response_model=List[BatchResponse])
async def list_batches(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all tracked medicine batch records.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    return await batch_repo.get_multi(db, skip=skip, limit=limit, store_id=current_user.store_id)

@router.post("/stock/adjust", response_model=StockResponse)
async def adjust_stock(
    adj_in: StockAdjustmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Perform a manual inventory stock level adjustment. Logs a stock movement history record.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    stock = await inventory_service.adjust_stock(db, current_user.id, adj_in, store_id=current_user.store_id)
    await db.commit()
    
    # Reload stock with batch and medicine relations populated
    from sqlalchemy.orm import selectinload
    from sqlalchemy.future import select
    from app.models.all_models import Stock, Batch, MedicineLocationMapping, Box, Shelf, Rack
    query = select(Stock).filter(Stock.id == stock.id).options(
        selectinload(Stock.batch).selectinload(Batch.medicine),
        selectinload(Stock.batch).selectinload(Batch.location_mapping).selectinload(MedicineLocationMapping.box).selectinload(Box.shelf).selectinload(Shelf.rack)
    )
    res = await db.execute(query)
    return res.scalars().first()

@router.get("/stock/movements", response_model=List[StockMovementResponse])
async def get_stock_movements(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve audit trails of all inventory quantity adjustments.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    return await stock_movement_repo.get_all_movements(db, skip=skip, limit=limit, store_id=current_user.store_id)
