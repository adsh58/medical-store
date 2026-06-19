from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
from typing import List

from app.database import get_db
from app.schemas.all_schemas import IntelligenceResponse, DeadStockResponse
from app.services.all_services import intelligence_service
from app.repositories.all_repos import intelligence_repo, medicine_repo
from app.core.dependencies import RoleChecker, get_current_user
from app.models.all_models import User
from app.core.exceptions import NotFoundException, BadRequestException

router = APIRouter(prefix="/intelligence", tags=["Inventory Intelligence"])

@router.post("/recalculate/{medicine_id}", response_model=IntelligenceResponse)
async def recalculate_metrics(
    medicine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Manually trigger intelligence calculations (average monthly sales, reorder suggestion status, overstock alerts) for a specific medicine in this store.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    med = await medicine_repo.get(db, medicine_id, store_id=current_user.store_id)
    if not med:
        raise NotFoundException("Medicine not found in this store")
        
    intel = await intelligence_service.calculate_inventory_metrics(db, medicine_id, store_id=current_user.store_id)
    await db.commit()
    return intel

@router.get("/{medicine_id}", response_model=IntelligenceResponse)
async def get_metrics(
    medicine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve computed intelligence metrics and suggestions for a specific medicine.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    med = await medicine_repo.get(db, medicine_id, store_id=current_user.store_id)
    if not med:
        raise NotFoundException("Medicine not found in this store")
        
    intel = await intelligence_repo.get_by_medicine(db, medicine_id)
    if not intel:
        intel = await intelligence_service.calculate_inventory_metrics(db, medicine_id, store_id=current_user.store_id)
        await db.commit()
    return intel

@router.get("/reports/dead-stock", response_model=List[DeadStockResponse])
async def get_dead_stock_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Generate dead stock inventory velocity analytics report (items with active stock and no sales for 90+ days).
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    return await intelligence_service.get_dead_stock_report(db, store_id=current_user.store_id)
