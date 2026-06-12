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

router = APIRouter(prefix="/inventory", tags=["Inventory Management"])

@router.get("/stock", response_model=List[StockResponse])
async def list_stock(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch current stock levels for all medicine batches.
    """
    from sqlalchemy.orm import selectinload
    from sqlalchemy.future import select
    from app.models.all_models import Stock, Batch
    # Query with eager loading to resolve nested schemas
    query = select(Stock).filter(Stock.deleted_at == None).offset(skip).limit(limit).options(
        selectinload(Stock.batch).selectinload(Batch.medicine)
    )
    res = await db.execute(query)
    return list(res.scalars().all())

@router.get("/stock/low", response_model=List[StockResponse])
async def list_low_stock(db: AsyncSession = Depends(get_db)):
    """
    Identify stock batches running below their reorder threshold level.
    """
    return await stock_repo.get_low_stock(db)

@router.get("/batches", response_model=List[BatchResponse])
async def list_batches(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """
    List all tracked medicine batch records.
    """
    return await batch_repo.get_multi(db, skip=skip, limit=limit)

@router.post("/stock/adjust", response_model=StockResponse)
async def adjust_stock(
    adj_in: StockAdjustmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Perform a manual inventory stock level adjustment. Logs a stock movement history record.
    """
    stock = await inventory_service.adjust_stock(db, current_user.id, adj_in)
    await db.commit()
    
    # Reload stock with batch and medicine relations populated
    from sqlalchemy.orm import selectinload
    from sqlalchemy.future import select
    from app.models.all_models import Stock, Batch
    query = select(Stock).filter(Stock.id == stock.id).options(
        selectinload(Stock.batch).selectinload(Batch.medicine)
    )
    res = await db.execute(query)
    return res.scalars().first()

@router.get("/stock/movements", response_model=List[StockMovementResponse])
async def get_stock_movements(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve audit trails of all inventory quantity adjustments.
    """
    return await stock_movement_repo.get_all_movements(db, skip=skip, limit=limit)

