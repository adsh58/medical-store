from fastapi import APIRouter, Depends, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict
import uuid
import os
import logging
from datetime import date, datetime, timedelta
from sqlalchemy.future import select

from app.database import get_db
from app.schemas.all_schemas import (
    PurchaseInvoiceCreate, PurchaseInvoiceResponse, 
    AIInvoiceProcessingLogResponse, MedicineCreate, PurchaseInvoiceItemCreate,
    AIInvoiceCommitRequest
)
from app.services.all_services import purchase_service, medicine_service
from app.services.ai_service import ai_service
from app.repositories.all_repos import invoice_repo, ai_log_repo, medicine_repo
from app.core.dependencies import RoleChecker, get_current_user
from app.models.all_models import User, Agency, MasterCategory
from app.core.exceptions import NotFoundException, BadRequestException

router = APIRouter(prefix="/purchases", tags=["Purchase Management"])
logger = logging.getLogger("app.routers.purchase")

@router.post("/invoices", response_model=PurchaseInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def log_purchase(
    invoice_in: PurchaseInvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Log a purchase invoice, updates stock batches, and evaluates pricing changes.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    invoice = await purchase_service.process_purchase_invoice(db, invoice_in, store_id=current_user.store_id, user_id=current_user.id)
    await db.commit()
    return invoice

@router.get("/invoices", response_model=List[PurchaseInvoiceResponse])
async def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List historical purchase invoices in this store.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    return await invoice_repo.get_multi(db, skip=skip, limit=limit, store_id=current_user.store_id)

@router.post("/invoices/upload-ai")
async def upload_invoice_ai(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    AI Invoice Scanning utilizing Gemini API Structured Output configuration.
    Extracts items, batch details, expiry dates, checks for duplicates and price changes,
    and returns a structured preview report without modifying the database.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    # 1. Define and create temp uploads folder
    temp_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_uploads")
    os.makedirs(temp_dir, exist_ok=True)
    
    # 2. Save file temporarily
    temp_filename = f"{uuid.uuid4()}_{file.filename}"
    temp_file_path = os.path.join(temp_dir, temp_filename)
    
    try:
        # Write bytes
        with open(temp_file_path, "wb") as buffer:
            file_bytes = await file.read()
            buffer.write(file_bytes)
        
        logger.info(f"File Uploaded for AI OCR: {file.filename}")
        
        # 3. Log AI attempt in processing logs
        log_obj = await ai_log_repo.create(db, obj_in={
            "file_name": file.filename,
            "file_size_bytes": len(file_bytes),
            "status": "PROCESSING"
        })
        await db.commit()
        
        # 4. Process via Gemini API extraction
        with open(temp_file_path, "rb") as f:
            temp_bytes = f.read()
            
        report = await ai_service.analyze_invoice(
            db, temp_bytes, file.filename, file.content_type, store_id=current_user.store_id
        )
        logger.info(f"Gemini OCR extraction completed for: {file.filename}")
        
        # 5. Check duplicate invoice existence
        is_duplicate = False
        query_agency = select(Agency).filter(Agency.name == report.supplier_name, Agency.store_id == current_user.store_id)
        res_agency = await db.execute(query_agency)
        agency = res_agency.scalars().first()
        if agency:
            existing = await invoice_repo.get_by_number(db, agency.id, report.invoice_number, store_id=current_user.store_id)
            if existing:
                is_duplicate = True
                
        # Update log status to successfully parsed
        log_obj.status = "SUCCESS"
        log_obj.processed_at = datetime.utcnow()
        db.add(log_obj)
        await db.commit()
        
        return {
            "success": True,
            "message": "AI invoice extracted and compared successfully.",
            "is_duplicate": is_duplicate,
            "report": report
        }
        
    except Exception as e:
        await db.rollback()
        try:
            log_obj.status = "FAILED"
            log_obj.error_message = str(e)
            log_obj.processed_at = datetime.utcnow()
            db.add(log_obj)
            await db.commit()
        except Exception:
            pass
            
        raise BadRequestException(f"AI Invoice processing failed: {str(e)}")
        
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            logger.info(f"File Deleted: {temp_file_path}")

@router.post("/invoices/commit-ai", response_model=PurchaseInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def commit_invoice_ai(
    payload: AIInvoiceCommitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "MANAGER"]))
):
    """
    Commit user-approved/modified AI invoice data.
    """
    if not current_user.store_id:
        raise BadRequestException("User does not belong to a store")
        
    invoice = await purchase_service.process_ai_commit(db, payload, store_id=current_user.store_id, user_id=current_user.id)
    await db.commit()
    return invoice


