from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database import get_db
from app.schemas.all_schemas import (
    RackCreate, RackResponse, ShelfCreate, ShelfResponse, 
    BoxCreate, BoxResponse, LocationMappingCreate, LocationMappingResponse
)
from app.services.all_services import rack_service
from app.repositories.all_repos import rack_repo
from app.core.dependencies import RoleChecker

router = APIRouter(prefix="/racks", tags=["Rack & Box Location Management"])

@router.post("/", response_model=RackResponse, status_code=status.HTTP_201_CREATED)
async def create_rack(
    rack_in: RackCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Establish a new storage Rack (e.g. Rack A).
    """
    rack = await rack_service.create_rack(db, rack_in)
    await db.commit()
    # Refresh to load shelves relationship
    await db.refresh(rack)
    return rack

@router.post("/shelves", response_model=ShelfResponse, status_code=status.HTTP_201_CREATED)
async def create_shelf(
    shelf_in: ShelfCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Establish a sub-shelf location inside a Rack (e.g. Shelf A1 under Rack A).
    """
    shelf = await rack_service.create_shelf(db, shelf_in)
    await db.commit()
    return shelf

@router.post("/boxes", response_model=BoxResponse, status_code=status.HTTP_201_CREATED)
async def create_box(
    box_in: BoxCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Establish a sub-box container inside a Shelf (e.g. Box 1 under Shelf A1).
    """
    box = await rack_service.create_box(db, box_in)
    await db.commit()
    return box

@router.get("/layout", response_model=List[RackResponse])
async def get_store_layout(db: AsyncSession = Depends(get_db)):
    """
    Render a complete physical blueprint layout representing all Racks, Shelves, Boxes, and mapped item counts.
    """
    return await rack_repo.get_layout(db)

@router.post("/map-location", response_model=LocationMappingResponse)
async def map_batch_location(
    mapping_in: LocationMappingCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER", "CASHIER"]))
):
    """
    Link a specific inventory Batch to a box storage location.
    """
    mapping = await rack_service.map_batch_location(db, mapping_in)
    await db.commit()
    
    # Load relationships for response schema resolution
    from sqlalchemy.orm import selectinload
    from sqlalchemy.future import select
    from app.models.all_models import MedicineLocationMapping
    query = select(MedicineLocationMapping).filter(MedicineLocationMapping.id == mapping.id).options(
        selectinload(MedicineLocationMapping.box)
    )
    res = await db.execute(query)
    return res.scalars().first()
