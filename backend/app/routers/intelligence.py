from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import get_db
from typing import List
from app.schemas.all_schemas import IntelligenceResponse, DeadStockResponse
from app.services.all_services import intelligence_service
from app.repositories.all_repos import intelligence_repo
from app.core.dependencies import RoleChecker
from app.core.exceptions import NotFoundException

router = APIRouter(prefix="/intelligence", tags=["Inventory Intelligence"])

@router.post("/recalculate/{medicine_id}", response_model=IntelligenceResponse)
async def recalculate_metrics(
    medicine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Manually trigger intelligence calculations (average monthly sales, reorder suggestion status, overstock alerts) for a specific medicine.
    """
    from app.repositories.all_repos import medicine_repo
    med = await medicine_repo.get(db, medicine_id)
    if not med:
        raise NotFoundException("Medicine not found")
        
    intel = await intelligence_service.calculate_inventory_metrics(db, medicine_id)
    await db.commit()
    return intel

@router.get("/{medicine_id}", response_model=IntelligenceResponse)
async def get_metrics(
    medicine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve computed intelligence metrics and suggestions for a specific medicine.
    """
    intel = await intelligence_repo.get_by_medicine(db, medicine_id)
    if not intel:
        # Generate default/first metrics
        intel = await intelligence_service.calculate_inventory_metrics(db, medicine_id)
        await db.commit()
    return intel

@router.get("/reports/dead-stock", response_model=List[DeadStockResponse])
async def get_dead_stock_report(
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Generate dead stock inventory velocity analytics report (items with active stock and no sales for 90+ days).
    """
    return await intelligence_service.get_dead_stock_report(db)

