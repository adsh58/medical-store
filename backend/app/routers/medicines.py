from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from app.database import get_db
from app.schemas.all_schemas import (
    MedicineCreate, MedicineResponse, PriceHistoryResponse,
    AssistantSearchRequest, AssistantSearchResponse, MedicineUpdate,
    MedicineCategoryCreate, MedicineCategoryResponse
)
from app.services.all_services import medicine_service
from app.services.ai_service import ai_service
from app.repositories.all_repos import medicine_repo, price_history_repo, category_repo
from app.core.dependencies import RoleChecker, get_current_user
from app.core.exceptions import NotFoundException

router = APIRouter(prefix="/medicines", tags=["Medicines Management"])


@router.post("/categories", response_model=MedicineCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_in: MedicineCategoryCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    from app.core.exceptions import BadRequestException
    existing = await category_repo.get_by_name(db, category_in.name)
    if existing:
        raise BadRequestException("Category with this name already exists")
    cat = await category_repo.create(db, obj_in=category_in.model_dump())
    await db.commit()
    return cat

@router.get("/categories", response_model=List[MedicineCategoryResponse])
async def list_categories(
    search: Optional[str] = Query(None, description="Search category name or description"),
    db: AsyncSession = Depends(get_db)
):
    if search:
        from sqlalchemy import or_
        from sqlalchemy.future import select
        from app.models.all_models import MedicineCategory
        query = select(MedicineCategory).filter(
            MedicineCategory.deleted_at == None,
            or_(
                MedicineCategory.name.ilike(f"%{search}%"),
                MedicineCategory.description.ilike(f"%{search}%")
            )
        )
        res = await db.execute(query)
        return list(res.scalars().all())
    
    return await category_repo.get_multi(db, limit=1000)

@router.put("/categories/{id}", response_model=MedicineCategoryResponse)
async def update_category(
    id: uuid.UUID,
    category_in: MedicineCategoryCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    from app.core.exceptions import BadRequestException
    cat = await category_repo.get(db, id)
    if not cat:
        raise NotFoundException("Category not found")
    
    if category_in.name and category_in.name != cat.name:
        existing = await category_repo.get_by_name(db, category_in.name)
        if existing:
            raise BadRequestException("Category with this name already exists")
            
    cat = await category_repo.update(db, db_obj=cat, obj_in=category_in.model_dump())
    await db.commit()
    return cat

@router.delete("/categories/{id}")
async def delete_category(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    cat = await category_repo.get(db, id)
    if not cat:
        raise NotFoundException("Category not found")
    await category_repo.remove(db, id=id)
    await db.commit()
    return {"success": True, "message": "Category deleted successfully"}


@router.put("/{id}", response_model=MedicineResponse)
async def update_medicine(
    id: uuid.UUID,
    medicine_in: MedicineUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    checker = RoleChecker(["ADMIN", "MANAGER"])
    checker(current_user)
    
    med = await medicine_service.update_medicine(db, id, medicine_in, current_user.id)
    await db.commit()
    return await medicine_repo.get(db, med.id)


@router.post("/", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
async def create_medicine(
    medicine_in: MedicineCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Add a new medicine to the central catalog catalog list.
    """
    med = await medicine_service.create_medicine(db, medicine_in)
    await db.commit()
    return med

@router.get("/", response_model=List[MedicineResponse])
async def list_medicines(
    search: Optional[str] = Query(None, description="Search term matching name, generic name, or company"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve paginated medicine records, optionally filtered by keyword search.
    """
    if search:
        return await medicine_repo.search(db, search, limit=limit)
    return await medicine_repo.get_multi(db, skip=skip, limit=limit)

@router.get("/{id}", response_model=MedicineResponse)
async def get_medicine(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Fetch a single medicine record details by UUID.
    """
    med = await medicine_repo.get(db, id)
    if not med:
        raise NotFoundException("Medicine not found")
    return med

@router.get("/{id}/price-history", response_model=List[PriceHistoryResponse])
async def get_price_history(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Audit log of doctor and customer retail rate changes for a specific medicine.
    """
    med = await medicine_repo.get(db, id)
    if not med:
        raise NotFoundException("Medicine not found")
    return await price_history_repo.get_by_medicine(db, id)

@router.post("/assistant-search", response_model=AssistantSearchResponse)
async def assistant_search(
    request: AssistantSearchRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Medicine Search Assistant. Identifies brand names using generic ingredients, symptoms, or conditions.
    """
    matches = await ai_service.search_assistant(db, request.query)
    
    # Map matched data structure to schema output
    items = []
    for match in matches:
        med = match["medicine"]
        items.append({
            "id": med.id,
            "name": med.name,
            "generic_name": med.generic_name,
            "company": med.company,
            "pack_size": med.pack_size,
            "mrp": float(med.mrp),
            "current_purchase_rate": float(med.current_purchase_rate),
            "doctor_selling_rate": float(med.doctor_selling_rate),
            "customer_selling_rate": float(med.customer_selling_rate),
            "matching_reason": match["matching_reason"],
            "confidence": float(match["confidence"])
        })
    return {"items": items}
