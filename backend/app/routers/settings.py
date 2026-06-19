from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from datetime import date, datetime, time
from typing import List, Optional

from app.database import get_db
from app.schemas.all_schemas import SystemSettingResponse, SystemSettingUpdate, SystemLogResponse
from app.services.all_services import setting_service
from app.core.dependencies import RoleChecker, get_current_user
from app.models.all_models import SystemLog, User

router = APIRouter(prefix="/settings", tags=["System Settings"])

@router.get("/", response_model=SystemSettingResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db)
):
    """
    Get active configuration settings.
    """
    return await setting_service.get_settings(db)

@router.put("/", response_model=SystemSettingResponse)
async def update_settings(
    settings_in: SystemSettingUpdate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Update configuration settings.
    """
    settings_obj = await setting_service.update_settings(db, settings_in)
    await db.commit()
    return settings_obj

@router.get("/logs", response_model=List[SystemLogResponse])
async def get_system_logs(
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    log_level: Optional[str] = Query(None, description="Log level filter (ERROR, WARNING, INFO)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Query system error and warning logs with date range and log level filters.
    Requires administrator or manager role.
    """
    query = select(SystemLog)
    filters = []
    
    if start_date:
        start_dt = datetime.combine(start_date, time.min)
        filters.append(SystemLog.created_at >= start_dt)
        
    if end_date:
        end_dt = datetime.combine(end_date, time.max)
        filters.append(SystemLog.created_at <= end_dt)
        
    if log_level:
        filters.append(SystemLog.log_level == log_level)
        
    if filters:
        query = query.where(and_(*filters))
        
    query = query.order_by(desc(SystemLog.created_at)).limit(300)
    res = await db.execute(query)
    logs = res.scalars().all()
    return logs
