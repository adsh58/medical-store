from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.all_schemas import SystemSettingResponse, SystemSettingUpdate
from app.services.all_services import setting_service
from app.core.dependencies import RoleChecker

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
