from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from app.database import get_db
from app.schemas.all_schemas import (
    MedicineCreate, MedicineResponse, PriceHistoryResponse,
    AssistantSearchRequest, AssistantSearchResponse
)
from app.services.all_services import medicine_service
from app.services.ai_service import ai_service
from app.repositories.all_repos import medicine_repo, price_history_repo
from app.core.dependencies import RoleChecker, get_current_user
from app.core.exceptions import NotFoundException

router = APIRouter(prefix="/medicines", tags=["Medicines Management"])

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
