from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from app.database import get_db
from app.schemas.all_schemas import DoctorCreate, DoctorResponse, DoctorUpdate
from app.core.dependencies import get_current_user
from app.models.all_models import User, Doctor
from app.repositories.all_repos import doctor_repo
from app.core.exceptions import NotFoundException, BadRequestException

router = APIRouter(prefix="/doctors", tags=["Doctors"])

@router.post("", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
async def create_doctor(
    doctor_in: DoctorCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new doctor business entity in the current user's store.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    # Check if doctor with same mobile exists in this store
    existing = await doctor_repo.get_by_mobile(db, doctor_in.mobile, store_id=current_user.store_id)
    if existing:
        raise BadRequestException("Doctor with this mobile number already exists in this store")
        
    doc = await doctor_repo.create(db, obj_in={
        **doctor_in.model_dump(),
        "store_id": current_user.store_id,
        "created_by_user_id": current_user.id,
        "updated_by_user_id": current_user.id
    })
    await db.commit()
    return doc

@router.get("", response_model=List[DoctorResponse])
async def list_doctors(
    search: Optional[str] = Query(None, description="Search doctor by name, mobile, or clinic"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all doctors in the current user's store with optional search filtering.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    if search:
        docs = await doctor_repo.search(db, search, store_id=current_user.store_id)
    else:
        docs = await doctor_repo.get_multi(db, store_id=current_user.store_id)
    return docs

@router.get("/{id}", response_model=DoctorResponse)
async def get_doctor(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve doctor details by ID.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    doc = await doctor_repo.get(db, id, store_id=current_user.store_id)
    if not doc:
        raise NotFoundException("Doctor not found")
    return doc

@router.put("/{id}", response_model=DoctorResponse)
async def update_doctor(
    id: uuid.UUID,
    doctor_in: DoctorUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update doctor details.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    doc = await doctor_repo.get(db, id, store_id=current_user.store_id)
    if not doc:
        raise NotFoundException("Doctor not found")
        
    if doctor_in.mobile and doctor_in.mobile != doc.mobile:
        existing = await doctor_repo.get_by_mobile(db, doctor_in.mobile, store_id=current_user.store_id)
        if existing:
            raise BadRequestException("Doctor with this mobile number already exists in this store")
            
    update_data = doctor_in.model_dump(exclude_unset=True)
    update_data["updated_by_user_id"] = current_user.id
    
    updated = await doctor_repo.update(db, db_obj=doc, obj_in=update_data)
    await db.commit()
    return updated

@router.delete("/{id}")
async def delete_doctor(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove/soft-delete a doctor registry record.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    doc = await doctor_repo.get(db, id, store_id=current_user.store_id)
    if not doc:
        raise NotFoundException("Doctor not found")
        
    await doctor_repo.remove(db, id=id, store_id=current_user.store_id)
    await db.commit()
    return {"success": True, "message": "Doctor deleted successfully"}
