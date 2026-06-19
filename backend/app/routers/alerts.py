from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import uuid
from datetime import datetime

from app.database import get_db
from app.schemas.all_schemas import ExpiryAlertResponse
from app.services.all_services import expiry_service
from app.repositories.all_repos import expiry_repo
from app.core.dependencies import RoleChecker, get_current_user
from app.models.all_models import User
from app.core.exceptions import NotFoundException, BadRequestException

router = APIRouter(prefix="/alerts", tags=["Expiry & Alert Tracking"])

@router.get("/expiry", response_model=List[ExpiryAlertResponse])
async def list_expiry_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all pending and active medicine expiry warning notifications in the current user's store.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    return await expiry_repo.get_pending_alerts(db, store_id=current_user.store_id)

@router.post("/expiry/trigger", response_model=List[ExpiryAlertResponse])
async def trigger_expiry_scan(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Trigger manual inventory scans mapping batches against 90-day/30-day thresholds.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    alerts = await expiry_service.check_expiry_dates(db, store_id=current_user.store_id)
    await db.commit()
    
    # Reload alerts with batch mapping relations populated
    if alerts:
        from sqlalchemy.orm import selectinload
        from sqlalchemy.future import select
        from app.models.all_models import ExpiryTracking, Batch
        alert_ids = [a.id for a in alerts]
        query = select(ExpiryTracking).join(ExpiryTracking.batch).filter(
            ExpiryTracking.id.in_(alert_ids),
            Batch.store_id == current_user.store_id
        ).options(
            selectinload(ExpiryTracking.batch).selectinload(Batch.medicine)
        )
        res = await db.execute(query)
        return list(res.scalars().all())
    return []

@router.post("/expiry/{id}/resolve", response_model=ExpiryAlertResponse)
async def resolve_expiry_alert(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Archive/Resolve a warning alert (e.g. medicine disposed of or returned).
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    from sqlalchemy.future import select
    from sqlalchemy.orm import selectinload
    from app.models.all_models import ExpiryTracking, Batch
    
    query = select(ExpiryTracking).join(ExpiryTracking.batch).filter(
        ExpiryTracking.id == id,
        Batch.store_id == current_user.store_id
    )
    res = await db.execute(query)
    alert = res.scalars().first()
    if not alert:
        raise NotFoundException("Alert not found")
        
    alert.status = "RESOLVED"
    alert.resolved_at = datetime.utcnow()
    alert.resolved_by = current_user.id
    db.add(alert)
    await db.commit()
    
    # Reload relationships
    query = select(ExpiryTracking).filter(ExpiryTracking.id == id).options(
        selectinload(ExpiryTracking.batch).selectinload(Batch.medicine)
    )
    res = await db.execute(query)
    return res.scalars().first()
