from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, date, timedelta, timezone
import uuid
from typing import List, Optional, Dict, Any

from app.core.exceptions import BadRequestException, NotFoundException, UnauthorizedException
from app.core.security import verify_password, hash_password, create_access_token, create_refresh_token
from app.models.all_models import (
    Role, User, Store, Doctor, MasterCategory, MasterMedicine, Medicine, Batch, Stock, 
    Sales, SaleItem, PurchaseHistory, ExpiryTracking, InventoryIntelligence, StockMovement,
    Customer, SystemSetting, PurchaseInvoice, PurchaseInvoiceItem
)
from app.schemas.all_schemas import (
    UserCreate, UserLogin, Token, MedicineCreate, AgencyCreate, 
    PurchaseInvoiceCreate, SaleCreate, RackCreate, ShelfCreate, BoxCreate, LocationMappingCreate,
    StockAdjustmentRequest, DeadStockResponse, MedicineUpdate, CustomerCreate, SystemSettingUpdate,
    AIInvoiceCommitRequest
)
from app.repositories.all_repos import (
    user_repo, role_repo, store_repo, doctor_repo, category_repo, master_medicine_repo,
    medicine_repo, agency_repo, invoice_repo, invoice_item_repo, batch_repo, stock_repo, 
    location_mapping_repo, sales_repo, sale_item_repo, price_history_repo, 
    purchase_history_repo, intelligence_repo, expiry_repo, rack_repo, shelf_repo, box_repo,
    stock_movement_repo, customer_repo, setting_repo, ai_log_repo
)

# ==========================================
# AUTHENTICATION SERVICE
# ==========================================
class AuthService:
    async def authenticate_user(self, db: AsyncSession, credentials: UserLogin) -> Token:
        user = await user_repo.get_by_email(db, credentials.email)
        if not user or not verify_password(credentials.password, user.password_hash):
            raise UnauthorizedException("Invalid email or password")
        if not user.is_active:
            raise UnauthorizedException("User account is inactive")
        
        access_token = create_access_token({"sub": str(user.id), "role": user.role.name})
        refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role.name})
        return Token(access_token=access_token, refresh_token=refresh_token)

    async def register_user(self, db: AsyncSession, user_in: UserCreate, store_id: Optional[uuid.UUID] = None) -> User:
        existing = await user_repo.get_by_email(db, user_in.email)
        if existing:
            raise BadRequestException("A user with this email already exists")
        
        role = await role_repo.get_by_name(db, user_in.role_name.upper())
        if not role:
            role = await role_repo.create(db, obj_in={"name": user_in.role_name.upper(), "description": f"{user_in.role_name} Role"})
        
        user_data = {
            "email": user_in.email,
            "password_hash": hash_password(user_in.password),
            "full_name": user_in.full_name,
            "role_id": role.id,
            "store_id": store_id,
            "is_active": True
        }
        user = await user_repo.create(db, obj_in=user_data)
        return user


# ==========================================
# MEDICINE SERVICE
# ==========================================
class MedicineService:
    async def create_medicine(self, db: AsyncSession, medicine_in: MedicineCreate, store_id: uuid.UUID, user_id: uuid.UUID) -> Medicine:
        category = await category_repo.get(db, medicine_in.category_id)
        if not category:
            raise BadRequestException("Selected category does not exist")
            
        master_med = await medicine_repo.get_by_name_global(db, medicine_in.name)
        if not master_med:
            from app.models.all_models import Company
            res_comp = await db.execute(select(Company).filter(Company.name == medicine_in.company, Company.deleted_at == None))
            comp_obj = res_comp.scalars().first()
            if not comp_obj:
                comp_obj = Company(name=medicine_in.company, type="Standard")
                db.add(comp_obj)
                await db.flush()
                
            master_med = await master_medicine_repo.create(db, obj_in={
                "category_id": medicine_in.category_id,
                "company_id": comp_obj.id,
                "name": medicine_in.name,
                "generic_name": medicine_in.generic_name,
                "company": medicine_in.company,
                "manufacturer": medicine_in.company,
                "pack_size": medicine_in.pack_size
            })
            
        existing = await db.execute(
            select(Medicine).filter(
                Medicine.store_id == store_id,
                Medicine.master_medicine_id == master_med.id
            )
        )
        med = existing.scalars().first()
        
        if med:
            if med.is_deleted:
                med.is_deleted = False
                med.deleted_at = None
                med.mrp = medicine_in.mrp
                med.purchase_rate = medicine_in.current_purchase_rate
                med.doctor_rate = medicine_in.doctor_selling_rate
                med.customer_rate = medicine_in.customer_selling_rate
                med.updated_by_user_id = user_id
                db.add(med)
                await db.flush()
                return med
            else:
                raise BadRequestException("Medicine with this name already exists in your store")
                
        med = await medicine_repo.create(db, obj_in={
            "store_id": store_id,
            "master_medicine_id": master_med.id,
            "mrp": medicine_in.mrp,
            "purchase_rate": medicine_in.current_purchase_rate,
            "doctor_rate": medicine_in.doctor_selling_rate,
            "customer_rate": medicine_in.customer_selling_rate,
            "created_by_user_id": user_id,
            "updated_by_user_id": user_id
        })
        return med

    async def update_medicine(self, db: AsyncSession, medicine_id: uuid.UUID, medicine_in: MedicineUpdate, store_id: uuid.UUID, user_id: uuid.UUID) -> Medicine:
        med = await medicine_repo.get(db, medicine_id, store_id=store_id)
        if not med:
            raise NotFoundException("Medicine not found")
        
        master_update = {}
        if medicine_in.name:
            conflict = await db.execute(
                select(MasterMedicine).filter(
                    MasterMedicine.name == medicine_in.name,
                    MasterMedicine.id != med.master_medicine_id
                )
            )
            if conflict.scalars().first():
                raise BadRequestException("Medicine with this name already exists")
            master_update["name"] = medicine_in.name
            
        if medicine_in.generic_name:
            master_update["generic_name"] = medicine_in.generic_name
        if medicine_in.company:
            from app.models.all_models import Company
            res_comp = await db.execute(select(Company).filter(Company.name == medicine_in.company, Company.deleted_at == None))
            comp_obj = res_comp.scalars().first()
            if not comp_obj:
                comp_obj = Company(name=medicine_in.company, type="Standard")
                db.add(comp_obj)
                await db.flush()
            master_update["company"] = medicine_in.company
            master_update["manufacturer"] = medicine_in.company
            master_update["company_id"] = comp_obj.id
        if medicine_in.pack_size:
            master_update["pack_size"] = medicine_in.pack_size
        if medicine_in.category_id:
            master_update["category_id"] = medicine_in.category_id

        if master_update:
            await master_medicine_repo.update(db, db_obj=med.master_medicine, obj_in=master_update)
            
        old_doctor_rate = float(med.doctor_rate)
        old_customer_rate = float(med.customer_rate)
        
        store_update = {}
        if medicine_in.mrp is not None:
            store_update["mrp"] = medicine_in.mrp
        if medicine_in.current_purchase_rate is not None:
            store_update["purchase_rate"] = medicine_in.current_purchase_rate
        if medicine_in.doctor_selling_rate is not None:
            store_update["doctor_rate"] = medicine_in.doctor_selling_rate
        if medicine_in.customer_selling_rate is not None:
            store_update["customer_rate"] = medicine_in.customer_selling_rate
            
        store_update["updated_by_user_id"] = user_id
        
        med = await medicine_repo.update(db, db_obj=med, obj_in=store_update)
        
        new_doctor_rate = float(med.doctor_rate)
        new_customer_rate = float(med.customer_rate)
        
        if old_doctor_rate != new_doctor_rate or old_customer_rate != new_customer_rate:
            await price_history_repo.create(db, obj_in={
                "medicine_id": med.id,
                "old_doctor_rate": old_doctor_rate,
                "new_doctor_rate": new_doctor_rate,
                "old_customer_rate": old_customer_rate,
                "new_customer_rate": new_customer_rate,
                "changed_by": user_id
            })
            
        return med


# ==========================================
# RACK & LOCATION SERVICE
# ==========================================
class RackService:
    async def create_rack(self, db: AsyncSession, rack_in: RackCreate, store_id: uuid.UUID, user_id: uuid.UUID):
        return await rack_repo.create(db, obj_in={
            **rack_in.model_dump(),
            "store_id": store_id,
            "created_by_user_id": user_id,
            "updated_by_user_id": user_id
        })

    async def create_shelf(self, db: AsyncSession, shelf_in: ShelfCreate, store_id: uuid.UUID, user_id: uuid.UUID):
        rack = await rack_repo.get(db, shelf_in.rack_id, store_id=store_id)
        if not rack:
            raise NotFoundException("Target Rack not found")
        existing = await shelf_repo.get_by_rack_and_name(db, shelf_in.rack_id, shelf_in.name, store_id=store_id)
        if existing:
            raise BadRequestException("Shelf name already exists in this rack")
        return await shelf_repo.create(db, obj_in={
            **shelf_in.model_dump(),
            "store_id": store_id,
            "created_by_user_id": user_id,
            "updated_by_user_id": user_id
        })

    async def create_box(self, db: AsyncSession, box_in: BoxCreate, store_id: uuid.UUID, user_id: uuid.UUID):
        shelf = await shelf_repo.get(db, box_in.shelf_id, store_id=store_id)
        if not shelf:
            raise NotFoundException("Target Shelf not found")
        existing = await box_repo.get_by_shelf_and_name(db, box_in.shelf_id, box_in.name, store_id=store_id)
        if existing:
            raise BadRequestException("Box name already exists on this shelf")
        return await box_repo.create(db, obj_in={
            **box_in.model_dump(),
            "store_id": store_id,
            "created_by_user_id": user_id,
            "updated_by_user_id": user_id
        })

    async def map_batch_location(self, db: AsyncSession, mapping_in: LocationMappingCreate, store_id: uuid.UUID, user_id: uuid.UUID):
        batch = await batch_repo.get(db, mapping_in.batch_id, store_id=store_id)
        if not batch:
            raise NotFoundException("Batch not found")
        box = await box_repo.get(db, mapping_in.box_id, store_id=store_id)
        if not box:
            raise NotFoundException("Box not found")
        
        existing = await location_mapping_repo.get_by_batch(db, mapping_in.batch_id)
        if existing:
            existing.box_id = mapping_in.box_id
            db.add(existing)
            await db.flush()
            return existing
        
        return await location_mapping_repo.create(db, obj_in=mapping_in.model_dump())


# ==========================================
# PURCHASE INVOICE & PRICING RECOMMENDATION
# ==========================================
class PurchaseService:
    async def process_purchase_invoice(self, db: AsyncSession, invoice_in: PurchaseInvoiceCreate, store_id: uuid.UUID, user_id: Optional[uuid.UUID] = None) -> PurchaseInvoice:
        agency = await agency_repo.get(db, invoice_in.agency_id, store_id=store_id)
        if not agency:
            raise NotFoundException("Agency not found")
        
        existing = await invoice_repo.get_by_number(db, invoice_in.agency_id, invoice_in.invoice_number, store_id=store_id)
        if existing:
            raise BadRequestException(f"Invoice {invoice_in.invoice_number} already logged for this agency")

        invoice_obj = await invoice_repo.create(db, obj_in={
            "store_id": store_id,
            "agency_id": invoice_in.agency_id,
            "invoice_number": invoice_in.invoice_number,
            "invoice_date": invoice_in.invoice_date,
            "total_amount": invoice_in.total_amount,
            "ai_status": "COMPLETED",
            "created_by_user_id": user_id,
            "updated_by_user_id": user_id
        })

        for item in invoice_in.items:
            medicine = await medicine_repo.get(db, item.medicine_id, store_id=store_id)
            if not medicine:
                raise NotFoundException(f"Medicine ID {item.medicine_id} not found")

            # Support free_quantity and gst from schemas if available
            free_qty = getattr(item, "free_quantity", 0)
            gst_rate = getattr(item, "gst", 0.0)

            await invoice_item_repo.create(db, obj_in={
                "invoice_id": invoice_obj.id,
                "medicine_id": item.medicine_id,
                "batch_number": item.batch_number,
                "quantity": item.quantity,
                "free_quantity": free_qty,
                "purchase_rate": item.purchase_rate,
                "expiry_date": item.expiry_date,
                "gst": gst_rate
            })

            batch = await batch_repo.get_by_medicine_and_number(db, item.medicine_id, item.batch_number, store_id=store_id)
            if not batch:
                batch = await batch_repo.create(db, obj_in={
                    "store_id": store_id,
                    "medicine_id": item.medicine_id,
                    "batch_number": item.batch_number,
                    "expiry_date": item.expiry_date,
                    "mrp": medicine.mrp,
                    "purchase_rate": item.purchase_rate,
                    "created_by_user_id": user_id,
                    "updated_by_user_id": user_id
                })

            total_received = item.quantity + free_qty
            stock = await stock_repo.get_by_batch(db, batch.id, store_id=store_id)
            if not stock:
                old_qty = 0
                stock = await stock_repo.create(db, obj_in={
                    "store_id": store_id,
                    "batch_id": batch.id,
                    "current_stock": total_received,
                    "minimum_stock": 10,
                    "reorder_level": 20,
                    "created_by_user_id": user_id,
                    "updated_by_user_id": user_id
                })
            else:
                old_qty = stock.current_stock
                stock.current_stock += total_received
                stock.updated_by_user_id = user_id
                db.add(stock)

            await stock_movement_repo.create(db, obj_in={
                "medicine_id": item.medicine_id,
                "batch_id": batch.id,
                "old_quantity": old_qty,
                "new_quantity": stock.current_stock,
                "difference": total_received,
                "reason": "PURCHASE",
                "user_id": user_id
            })

            old_purchase_rate = float(medicine.purchase_rate)
            if old_purchase_rate != item.purchase_rate:
                await purchase_history_repo.create(db, obj_in={
                    "medicine_id": item.medicine_id,
                    "agency_id": invoice_in.agency_id,
                    "invoice_id": invoice_obj.id,
                    "batch_number": item.batch_number,
                    "old_purchase_rate": old_purchase_rate,
                    "new_purchase_rate": item.purchase_rate
                })
                
                medicine.purchase_rate = item.purchase_rate
                
                recommended_customer_rate = min(item.purchase_rate * 1.30, float(medicine.mrp))
                recommended_doctor_rate = min(item.purchase_rate * 1.15, float(medicine.mrp))
                
                medicine.customer_rate = recommended_customer_rate
                medicine.doctor_rate = recommended_doctor_rate
                medicine.updated_by_user_id = user_id
                db.add(medicine)

        from sqlalchemy.orm import selectinload
        res = await db.execute(
            select(PurchaseInvoice)
            .filter(PurchaseInvoice.id == invoice_obj.id)
            .options(selectinload(PurchaseInvoice.items))
        )
        return res.scalars().first()

    async def process_ai_commit(self, db: AsyncSession, payload: AIInvoiceCommitRequest, store_id: uuid.UUID, user_id: Optional[uuid.UUID] = None) -> PurchaseInvoice:
        agency = await agency_repo.get(db, payload.agency_id, store_id=store_id)
        if not agency:
            raise NotFoundException("Agency not found")

        invoice_number = payload.invoice_number
        existing = await invoice_repo.get_by_number(db, payload.agency_id, invoice_number, store_id=store_id)
        
        if existing:
            resolution = payload.conflict_resolution
            if not resolution:
                raise BadRequestException("DUPLICATE_INVOICE")
            elif resolution == "reprocess":
                suffix_counter = 1
                new_invoice_number = f"{invoice_number}-DUP{suffix_counter}"
                while await invoice_repo.get_by_number(db, payload.agency_id, new_invoice_number, store_id=store_id):
                    suffix_counter += 1
                    new_invoice_number = f"{invoice_number}-DUP{suffix_counter}"
                invoice_number = new_invoice_number
            elif resolution == "replace":
                old_items = await db.execute(
                    select(PurchaseInvoiceItem).filter(PurchaseInvoiceItem.invoice_id == existing.id)
                )
                for old_item in old_items.scalars().all():
                    batch = await batch_repo.get_by_medicine_and_number(db, old_item.medicine_id, old_item.batch_number, store_id=store_id)
                    if batch:
                        stock = await stock_repo.get_by_batch(db, batch.id, store_id=store_id)
                        if stock:
                            old_qty = stock.current_stock
                            total_qty = old_item.quantity + old_item.free_quantity
                            new_qty = max(0, old_qty - total_qty)
                            stock.current_stock = new_qty
                            db.add(stock)
                            
                            await stock_movement_repo.create(db, obj_in={
                                "medicine_id": old_item.medicine_id,
                                "batch_id": batch.id,
                                "old_quantity": old_qty,
                                "new_quantity": new_qty,
                                "difference": -total_qty,
                                "reason": "PURCHASE_REVERSAL",
                                "user_id": user_id
                            })
                await invoice_repo.remove(db, id=existing.id)
                await db.flush()

        total_amount = sum(item.purchase_rate * item.quantity for item in payload.items)
        invoice_obj = await invoice_repo.create(db, obj_in={
            "store_id": store_id,
            "agency_id": payload.agency_id,
            "invoice_number": invoice_number,
            "invoice_date": payload.invoice_date,
            "total_amount": total_amount,
            "ai_status": "COMPLETED",
            "created_by_user_id": user_id,
            "updated_by_user_id": user_id
        })
        await db.flush()

        for item in payload.items:
            medicine = None
            if item.medicine_id:
                medicine = await medicine_repo.get(db, item.medicine_id, store_id=store_id)
            if not medicine:
                medicine = await medicine_repo.get_by_name(db, item.medicine_name, store_id=store_id)
                
            if not medicine:
                category_id = item.category_id
                if not category_id:
                    res_cat = await db.execute(select(MasterCategory).filter(MasterCategory.name == "Uncategorized"))
                    category = res_cat.scalars().first()
                    if not category:
                        category = MasterCategory(name="Uncategorized", description="AI Auto-Created")
                        db.add(category)
                        await db.flush()
                    category_id = category.id
                
                extracted_pack = item.pack_size or "AI Extracted Pack"
                extracted_company = item.company or "AI Extracted Company"
                extracted_generic = item.generic_name or "AI Extracted Generic"
                
                med_in = MedicineCreate(
                    category_id=category_id,
                    name=item.medicine_name,
                    generic_name=extracted_generic,
                    company=extracted_company,
                    pack_size=extracted_pack,
                    mrp=item.mrp,
                    current_purchase_rate=item.purchase_rate,
                    doctor_selling_rate=item.doctor_rate,
                    customer_selling_rate=item.customer_rate,
                    bypass_validation=True
                )
                medicine = await medicine_service.create_medicine(db, med_in, store_id=store_id, user_id=user_id)
                await db.flush()
            else:
                old_mrp = float(medicine.mrp)
                old_purchase_rate = float(medicine.purchase_rate)
                old_doctor_rate = float(medicine.doctor_rate)
                old_customer_rate = float(medicine.customer_rate)
                
                if old_doctor_rate != item.doctor_rate or old_customer_rate != item.customer_rate:
                    await price_history_repo.create(db, obj_in={
                        "medicine_id": medicine.id,
                        "old_doctor_rate": old_doctor_rate,
                        "new_doctor_rate": item.doctor_rate,
                        "old_customer_rate": old_customer_rate,
                        "new_customer_rate": item.customer_rate,
                        "changed_by": user_id,
                        "changed_at": datetime.utcnow()
                    })
                
                if old_purchase_rate != item.purchase_rate:
                    await purchase_history_repo.create(db, obj_in={
                        "medicine_id": medicine.id,
                        "agency_id": payload.agency_id,
                        "invoice_id": invoice_obj.id,
                        "batch_number": item.batch_number,
                        "old_purchase_rate": old_purchase_rate,
                        "new_purchase_rate": item.purchase_rate
                    })
                
                medicine.mrp = item.mrp
                medicine.purchase_rate = item.purchase_rate
                medicine.doctor_rate = item.doctor_rate
                medicine.customer_rate = item.customer_rate
                if item.category_id:
                    medicine.master_medicine.category_id = item.category_id
                if item.company:
                    from app.models.all_models import Company
                    res_comp = await db.execute(select(Company).filter(Company.name == item.company, Company.deleted_at == None))
                    comp_obj = res_comp.scalars().first()
                    if not comp_obj:
                        comp_obj = Company(name=item.company, type="Standard")
                        db.add(comp_obj)
                        await db.flush()
                    medicine.master_medicine.company = item.company
                    medicine.master_medicine.company_id = comp_obj.id
                medicine.updated_by_user_id = user_id
                db.add(medicine)
                await db.flush()

            await invoice_item_repo.create(db, obj_in={
                "invoice_id": invoice_obj.id,
                "medicine_id": medicine.id,
                "batch_number": item.batch_number,
                "quantity": item.quantity,
                "free_quantity": item.free_quantity,
                "purchase_rate": item.purchase_rate,
                "expiry_date": item.expiry_date,
                "gst": item.gst
            })

            batch = await batch_repo.get_by_medicine_and_number(db, medicine.id, item.batch_number, store_id=store_id)
            if not batch:
                batch = await batch_repo.create(db, obj_in={
                    "store_id": store_id,
                    "medicine_id": medicine.id,
                    "batch_number": item.batch_number,
                    "expiry_date": item.expiry_date,
                    "mrp": item.mrp,
                    "purchase_rate": item.purchase_rate,
                    "created_by_user_id": user_id,
                    "updated_by_user_id": user_id
                })
            else:
                batch.expiry_date = item.expiry_date
                batch.mrp = item.mrp
                batch.purchase_rate = item.purchase_rate
                batch.updated_by_user_id = user_id
                db.add(batch)
            await db.flush()

            total_qty_received = item.quantity + item.free_quantity
            stock = await stock_repo.get_by_batch(db, batch.id, store_id=store_id)
            if not stock:
                old_qty = 0
                stock = await stock_repo.create(db, obj_in={
                    "store_id": store_id,
                    "batch_id": batch.id,
                    "current_stock": total_qty_received,
                    "minimum_stock": 10,
                    "reorder_level": 20,
                    "created_by_user_id": user_id,
                    "updated_by_user_id": user_id
                })
            else:
                old_qty = stock.current_stock
                stock.current_stock += total_qty_received
                stock.updated_by_user_id = user_id
                db.add(stock)
            await db.flush()

            await stock_movement_repo.create(db, obj_in={
                "medicine_id": medicine.id,
                "batch_id": batch.id,
                "old_quantity": old_qty,
                "new_quantity": stock.current_stock,
                "difference": total_qty_received,
                "reason": "PURCHASE",
                "user_id": user_id
            })

            if item.purchase_rate > item.doctor_rate or item.purchase_rate > item.customer_rate:
                from app.models.all_models import SystemLog
                log_entry = SystemLog(
                    store_id=store_id,
                    log_level="WARNING",
                    module="purchases",
                    message=(
                        f"Rate Review Required: Purchase Rate increased above selling rates for '{item.medicine_name}'.\n\n"
                        f"Doctor Rate: ₹{item.doctor_rate:.2f}\n"
                        f"Customer Rate: ₹{item.customer_rate:.2f}\n"
                        f"New Purchase Rate: ₹{item.purchase_rate:.2f}\n\n"
                        f"Please review pricing."
                    ),
                    request_path="/api/v1/purchases/invoices/commit-ai",
                    request_method="POST",
                    user_id=user_id
                )
                db.add(log_entry)

        await ai_log_repo.create(db, obj_in={
            "invoice_id": invoice_obj.id,
            "file_name": f"Committed: {invoice_number}",
            "file_size_bytes": 0,
            "status": "SUCCESS",
            "processed_at": datetime.utcnow()
        })
        
        from sqlalchemy.orm import selectinload
        res = await db.execute(
            select(PurchaseInvoice)
            .filter(PurchaseInvoice.id == invoice_obj.id)
            .options(selectinload(PurchaseInvoice.items))
        )
        return res.scalars().first()


# ==========================================
# SALES TRANSACTION SERVICE
# ==========================================
class SalesService:
    async def create_sale(self, db: AsyncSession, cashier_id: uuid.UUID, sale_in: SaleCreate, store_id: uuid.UUID) -> Sales:
        total_amount = 0.0
        discount_amount = 0.0
        sale_items_data = []

        for item in sale_in.items:
            batch = await batch_repo.get(db, item.batch_id, store_id=store_id)
            if not batch:
                raise NotFoundException(f"Batch ID {item.batch_id} not found")
            
            stock = await stock_repo.get_by_batch(db, batch.id, store_id=store_id)
            if not stock or stock.current_stock < item.quantity:
                raise BadRequestException(f"Insufficient stock for batch {batch.batch_number}. Available: {stock.current_stock if stock else 0}")

            old_qty = stock.current_stock
            stock.current_stock -= item.quantity
            stock.updated_by_user_id = cashier_id
            db.add(stock)

            await stock_movement_repo.create(db, obj_in={
                "medicine_id": batch.medicine_id,
                "batch_id": batch.id,
                "old_quantity": old_qty,
                "new_quantity": stock.current_stock,
                "difference": -item.quantity,
                "reason": "SALE",
                "user_id": cashier_id
            })

            unit_price = float(batch.mrp)
            gross = unit_price * item.quantity
            net = gross - item.discount_amount
            if net < 0:
                raise BadRequestException(f"Discount exceeds items value for batch {batch.batch_number}")

            total_amount += gross
            discount_amount += item.discount_amount

            sale_items_data.append({
                "store_id": store_id,
                "batch_id": batch.id,
                "quantity": item.quantity,
                "unit_price": unit_price,
                "discount_amount": item.discount_amount,
                "net_amount": net
            })

        sale = await sales_repo.create(db, obj_in={
            "store_id": store_id,
            "cashier_id": cashier_id,
            "doctor_id": sale_in.doctor_id,
            "customer_name": sale_in.customer_name,
            "customer_phone": sale_in.customer_phone,
            "total_amount": total_amount,
            "discount_amount": discount_amount,
            "net_amount": total_amount - discount_amount,
            "payment_mode": sale_in.payment_mode,
            "created_by_user_id": cashier_id,
            "updated_by_user_id": cashier_id
        })

        for it_data in sale_items_data:
            it_data["sale_id"] = sale.id
            await sale_item_repo.create(db, obj_in=it_data)

        return sale


# ==========================================
# INVENTORY INTELLIGENCE SERVICE
# ==========================================
class IntelligenceService:
    async def calculate_inventory_metrics(self, db: AsyncSession, medicine_id: uuid.UUID, store_id: uuid.UUID) -> InventoryIntelligence:
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        query = select(SaleItem).join(Sales).filter(
            SaleItem.batch.has(Batch.medicine_id == medicine_id),
            Sales.store_id == store_id,
            Sales.created_at >= thirty_days_ago
        )
        res = await db.execute(query)
        sale_items = res.scalars().all()
        
        total_sold = sum(item.quantity for item in sale_items)
        avg_monthly_sales = float(total_sold)
        
        query_stock = select(Stock).join(Batch).filter(Batch.medicine_id == medicine_id, Batch.store_id == store_id)
        res_stock = await db.execute(query_stock)
        stocks = res_stock.scalars().all()
        
        total_stock = sum(s.current_stock for s in stocks)
        min_stock = sum(s.minimum_stock for s in stocks) if stocks else 10
        reorder_level = sum(s.reorder_level for s in stocks) if stocks else 20

        if total_stock < min_stock:
            status = "UNDERSTOCK"
        elif total_stock > (reorder_level * 3):
            status = "OVERSTOCK"
        else:
            status = "NORMAL"

        suggested = max(0, int((avg_monthly_sales * 1.5) - total_stock))

        intel = await intelligence_repo.get_by_medicine(db, medicine_id)
        if intel:
            intel.avg_monthly_sales = avg_monthly_sales
            intel.suggested_reorder_qty = suggested
            intel.inventory_status = status
            intel.last_calculated_at = datetime.utcnow()
            db.add(intel)
        else:
            intel = await intelligence_repo.create(db, obj_in={
                "medicine_id": medicine_id,
                "avg_monthly_sales": avg_monthly_sales,
                "suggested_reorder_qty": suggested,
                "inventory_status": status,
                "last_calculated_at": datetime.utcnow()
            })
        return intel

    async def get_dead_stock_report(self, db: AsyncSession, store_id: uuid.UUID) -> List[Dict[str, Any]]:
        from sqlalchemy import func
        from app.models.all_models import Medicine, SaleItem, Sales, Batch, Stock
        
        query_meds = select(Medicine).filter(Medicine.deleted_at == None, Medicine.store_id == store_id)
        res_meds = await db.execute(query_meds)
        medicines = res_meds.scalars().all()
        
        dead_stock_items = []
        ninety_days_ago = datetime.utcnow() - timedelta(days=90)
        
        for med in medicines:
            query_sale = select(func.max(Sales.created_at)).join(SaleItem, Sales.id == SaleItem.sale_id).join(Batch, SaleItem.batch_id == Batch.id).filter(
                Batch.medicine_id == med.id,
                Sales.store_id == store_id,
                Sales.deleted_at == None
            )
            res_sale = await db.execute(query_sale)
            last_sale_date = res_sale.scalar()
            
            query_stock = select(Stock).join(Batch).filter(
                Batch.medicine_id == med.id,
                Stock.store_id == store_id,
                Stock.deleted_at == None
            )
            res_stock = await db.execute(query_stock)
            stocks = res_stock.scalars().all()
            
            total_stock = sum(s.current_stock for s in stocks)
            
            if total_stock > 0:
                is_dead = False
                if last_sale_date is None:
                    is_dead = True
                elif last_sale_date < ninety_days_ago:
                    is_dead = True
                    
                if is_dead:
                    stock_value = sum(s.current_stock * float(s.batch.purchase_rate) for s in stocks)
                    dead_stock_items.append({
                        "medicine_id": med.id,
                        "medicine_name": med.name,
                        "generic_name": med.generic_name,
                        "company": med.company,
                        "current_stock": total_stock,
                        "last_sale_date": last_sale_date,
                        "stock_value": round(stock_value, 2)
                    })
                    
        return dead_stock_items


# ==========================================
# EXPIRY ALERTS MONITOR SERVICE
# ==========================================
class ExpiryService:
    async def check_expiry_dates(self, db: AsyncSession, store_id: uuid.UUID) -> List[ExpiryTracking]:
        today = date.today()
        ninety_days = today + timedelta(days=90)
        thirty_days = today + timedelta(days=30)

        query = select(Batch).filter(Batch.deleted_at == None, Batch.store_id == store_id)
        res = await db.execute(query)
        batches = res.scalars().all()
        alerts = []

        for b in batches:
            if b.expiry_date <= today:
                alert_type = "EXPIRED"
            elif b.expiry_date <= thirty_days:
                alert_type = "EXPIRY_30_DAYS"
            elif b.expiry_date <= ninety_days:
                alert_type = "EXPIRY_90_DAYS"
            else:
                continue

            query_alert = select(ExpiryTracking).filter(
                ExpiryTracking.batch_id == b.id,
                ExpiryTracking.alert_type == alert_type
            )
            res_alert = await db.execute(query_alert)
            exists = res_alert.scalars().first()

            if not exists:
                alert = await expiry_repo.create(db, obj_in={
                    "batch_id": b.id,
                    "alert_date": today,
                    "alert_type": alert_type,
                    "status": "PENDING"
                })
                alerts.append(alert)

        return alerts


class InventoryService:
    async def adjust_stock(
        self, db: AsyncSession, user_id: uuid.UUID, adj_in: StockAdjustmentRequest, store_id: uuid.UUID
    ) -> Stock:
        batch = await batch_repo.get(db, adj_in.batch_id, store_id=store_id)
        if not batch:
            raise NotFoundException("Batch not found")
        
        stock = await stock_repo.get_by_batch(db, batch.id, store_id=store_id)
        if not stock:
            old_qty = 0
            stock = await stock_repo.create(db, obj_in={
                "store_id": store_id,
                "batch_id": batch.id,
                "current_stock": adj_in.new_quantity,
                "minimum_stock": 10,
                "reorder_level": 20,
                "created_by_user_id": user_id,
                "updated_by_user_id": user_id
            })
        else:
            old_qty = stock.current_stock
            stock.current_stock = adj_in.new_quantity
            stock.updated_by_user_id = user_id
            db.add(stock)
        
        diff = adj_in.new_quantity - old_qty
        if diff != 0:
            await stock_movement_repo.create(db, obj_in={
                "medicine_id": batch.medicine_id,
                "batch_id": batch.id,
                "old_quantity": old_qty,
                "new_quantity": adj_in.new_quantity,
                "difference": diff,
                "reason": adj_in.reason.upper(),
                "user_id": user_id
            })
        
        return stock


class CustomerService:
    async def create_customer(self, db: AsyncSession, customer_in: CustomerCreate, store_id: uuid.UUID, user_id: uuid.UUID):
        existing = await customer_repo.get_by_phone_global(db, customer_in.phone, store_id=store_id)
        if existing:
            if existing.is_deleted:
                existing.is_deleted = False
                existing.deleted_at = None
                for field, value in customer_in.model_dump().items():
                    setattr(existing, field, value)
                existing.updated_by_user_id = user_id
                db.add(existing)
                await db.flush()
                return existing
            else:
                raise BadRequestException("Customer with this phone number already registered")
        return await customer_repo.create(db, obj_in={
            **customer_in.model_dump(),
            "store_id": store_id,
            "created_by_user_id": user_id,
            "updated_by_user_id": user_id
        })

    async def update_customer(self, db: AsyncSession, customer_id: uuid.UUID, customer_in: CustomerCreate, store_id: uuid.UUID, user_id: uuid.UUID):
        cust = await customer_repo.get(db, customer_id, store_id=store_id)
        if not cust:
            raise NotFoundException("Customer not found")
        if customer_in.phone and customer_in.phone != cust.phone:
            existing = await customer_repo.get_by_phone_global(db, customer_in.phone, store_id=store_id)
            if existing:
                raise BadRequestException("Customer with this phone number already registered")
        update_data = customer_in.model_dump(exclude_unset=True)
        update_data["updated_by_user_id"] = user_id
        return await customer_repo.update(db, db_obj=cust, obj_in=update_data)


class SystemSettingService:
    async def get_settings(self, db: AsyncSession, store_id: uuid.UUID):
        return await setting_repo.get_singleton(db, store_id=store_id)

    async def update_settings(self, db: AsyncSession, settings_in: SystemSettingUpdate, store_id: uuid.UUID):
        setting = await setting_repo.get_singleton(db, store_id=store_id)
        update_data = settings_in.model_dump(exclude_unset=True)
        updated = await setting_repo.update(db, db_obj=setting, obj_in=update_data)
        return updated


# Instantiate service layer singletons
auth_service = AuthService()
medicine_service = MedicineService()
rack_service = RackService()
purchase_service = PurchaseService()
sales_service = SalesService()
intelligence_service = IntelligenceService()
expiry_service = ExpiryService()
inventory_service = InventoryService()
customer_service = CustomerService()
setting_service = SystemSettingService()
