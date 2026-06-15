from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import uuid

from app.database import get_db
from app.schemas.all_schemas import (
    RackCreate, RackResponse, ShelfCreate, ShelfResponse, 
    BoxCreate, BoxResponse, LocationMappingCreate, LocationMappingResponse
)
from app.services.all_services import rack_service
from app.repositories.all_repos import rack_repo, shelf_repo, box_repo
from app.core.dependencies import RoleChecker
from app.core.exceptions import NotFoundException

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
    
    from sqlalchemy.orm import selectinload
    from sqlalchemy.future import select
    from app.models.all_models import Rack, Shelf
    query = select(Rack).filter(Rack.id == rack.id).options(
        selectinload(Rack.shelves).selectinload(Shelf.boxes)
    )
    res = await db.execute(query)
    return res.scalars().first()

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
    
    from sqlalchemy.orm import selectinload
    from sqlalchemy.future import select
    from app.models.all_models import Shelf
    query = select(Shelf).filter(Shelf.id == shelf.id).options(
        selectinload(Shelf.boxes)
    )
    res = await db.execute(query)
    return res.scalars().first()

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


@router.put("/{id}", response_model=RackResponse)
async def update_rack(
    id: uuid.UUID,
    rack_in: RackCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    rack = await rack_repo.get(db, id)
    if not rack:
        raise NotFoundException("Rack not found")
    rack = await rack_repo.update(db, db_obj=rack, obj_in=rack_in.model_dump())
    await db.commit()
    
    from sqlalchemy.orm import selectinload
    from sqlalchemy.future import select
    from app.models.all_models import Rack, Shelf
    query = select(Rack).filter(Rack.id == rack.id).options(
        selectinload(Rack.shelves).selectinload(Shelf.boxes)
    )
    res = await db.execute(query)
    return res.scalars().first()

@router.delete("/{id}")
async def delete_rack(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    rack = await rack_repo.get(db, id)
    if not rack:
        raise NotFoundException("Rack not found")
    await rack_repo.remove(db, id=id)
    await db.commit()
    return {"success": True, "message": "Rack deleted successfully"}

@router.put("/shelves/{id}", response_model=ShelfResponse)
async def update_shelf(
    id: uuid.UUID,
    shelf_in: ShelfCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    shelf = await shelf_repo.get(db, id)
    if not shelf:
        raise NotFoundException("Shelf not found")
    shelf = await shelf_repo.update(db, db_obj=shelf, obj_in=shelf_in.model_dump())
    await db.commit()
    
    from sqlalchemy.orm import selectinload
    from sqlalchemy.future import select
    from app.models.all_models import Shelf
    query = select(Shelf).filter(Shelf.id == shelf.id).options(selectinload(Shelf.boxes))
    res = await db.execute(query)
    return res.scalars().first()

@router.delete("/shelves/{id}")
async def delete_shelf(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    shelf = await shelf_repo.get(db, id)
    if not shelf:
        raise NotFoundException("Shelf not found")
    await shelf_repo.remove(db, id=id)
    await db.commit()
    return {"success": True, "message": "Shelf deleted successfully"}

@router.put("/boxes/{id}", response_model=BoxResponse)
async def update_box(
    id: uuid.UUID,
    box_in: BoxCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    box = await box_repo.get(db, id)
    if not box:
        raise NotFoundException("Box not found")
    box = await box_repo.update(db, db_obj=box, obj_in=box_in.model_dump())
    await db.commit()
    return box

@router.delete("/boxes/{id}")
async def delete_box(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    box = await box_repo.get(db, id)
    if not box:
        raise NotFoundException("Box not found")
    await box_repo.remove(db, id=id)
    await db.commit()
    return {"success": True, "message": "Box deleted successfully"}

