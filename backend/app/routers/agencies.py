from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from app.database import get_db
from app.schemas.all_schemas import AgencyCreate, AgencyResponse
from app.repositories.all_repos import agency_repo
from app.core.dependencies import RoleChecker
from app.core.exceptions import NotFoundException, BadRequestException
from app.models.all_models import User

router = APIRouter(prefix="/agencies", tags=["Agencies (Suppliers)"])

@router.post("/", response_model=AgencyResponse, status_code=status.HTTP_201_CREATED)
async def create_agency(
    agency_in: AgencyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Register a new supplying agency in the database.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    existing = await agency_repo.get_by_name(db, agency_in.name, store_id=current_user.store_id)
    if existing:
        raise BadRequestException("Agency with this name already exists")
        
    agency = await agency_repo.create(db, obj_in={
        **agency_in.model_dump(),
        "store_id": current_user.store_id,
        "created_by_user_id": current_user.id,
        "updated_by_user_id": current_user.id
    })
    await db.commit()
    return agency

@router.get("/", response_model=List[AgencyResponse])
async def list_agencies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER", "CASHIER"]))
):
    """
    Fetch paginated list of registered agencies in the active store.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    return await agency_repo.get_multi(db, skip=skip, limit=limit, store_id=current_user.store_id)

@router.get("/{id}", response_model=AgencyResponse)
async def get_agency(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER", "CASHIER"]))
):
    """
    Retrieve details of a specific supplying agency.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    agency = await agency_repo.get(db, id, store_id=current_user.store_id)
    if not agency:
        raise NotFoundException("Agency not found")
    return agency
