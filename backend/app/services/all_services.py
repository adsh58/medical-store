from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, date, timedelta, timezone
import uuid
from typing import List, Optional, Dict, Any

from app.core.exceptions import BadRequestException, NotFoundException, UnauthorizedException
from app.core.security import verify_password, hash_password, create_access_token, create_refresh_token
from app.models.all_models import Role, User, Medicine, Batch, Stock, Sales, SaleItem, PurchaseHistory, ExpiryTracking, InventoryIntelligence, StockMovement
from app.schemas.all_schemas import (
    UserCreate, UserLogin, Token, MedicineCreate, AgencyCreate, 
    PurchaseInvoiceCreate, SaleCreate, RackCreate, ShelfCreate, BoxCreate, LocationMappingCreate,
    StockAdjustmentRequest, DeadStockResponse, MedicineUpdate, CustomerCreate, SystemSettingUpdate
)
from app.repositories.all_repos import (
    user_repo, role_repo, medicine_repo, category_repo, agency_repo, 
    invoice_repo, invoice_item_repo, batch_repo, stock_repo, 
    location_mapping_repo, sales_repo, sale_item_repo, price_history_repo, 
    purchase_history_repo, intelligence_repo, expiry_repo, rack_repo, shelf_repo, box_repo,
    stock_movement_repo, customer_repo, setting_repo
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

    async def register_user(self, db: AsyncSession, user_in: UserCreate) -> User:
        existing = await user_repo.get_by_email(db, user_in.email)
        if existing:
            raise BadRequestException("A user with this email already exists")
        
        role = await role_repo.get_by_name(db, user_in.role_name.upper())
        if not role:
            # Seed role if missing
            role = await role_repo.create(db, obj_in={"name": user_in.role_name.upper(), "description": f"{user_in.role_name} Role"})
        
        user_data = {
            "email": user_in.email,
            "password_hash": hash_password(user_in.password),
            "full_name": user_in.full_name,
            "role_id": role.id,
            "is_active": True
        }
        user = await user_repo.create(db, obj_in=user_data)
        return user

# ==========================================
# MEDICINE SERVICE
# ==========================================
class MedicineService:
    async def create_medicine(self, db: AsyncSession, medicine_in: MedicineCreate) -> Medicine:
        existing = await medicine_repo.get_by_name(db, medicine_in.name)
        if existing:
            raise BadRequestException("Medicine with this name already exists")
        
        med = await medicine_repo.create(db, obj_in=medicine_in.model_dump())
        return med

    async def update_medicine(self, db: AsyncSession, medicine_id: uuid.UUID, medicine_in: MedicineUpdate, changed_by: uuid.UUID) -> Medicine:
        med = await medicine_repo.get(db, medicine_id)
        if not med:
            raise NotFoundException("Medicine not found")
        
        if medicine_in.name and medicine_in.name != med.name:
            existing = await medicine_repo.get_by_name(db, medicine_in.name)
            if existing:
                raise BadRequestException("Medicine with this name already exists")
        
        old_doctor_rate = float(med.doctor_selling_rate)
        old_customer_rate = float(med.customer_selling_rate)
        
        update_data = medicine_in.model_dump(exclude_unset=True)
        med = await medicine_repo.update(db, db_obj=med, obj_in=update_data)
        
        new_doctor_rate = float(med.doctor_selling_rate)
        new_customer_rate = float(med.customer_selling_rate)
        
        if old_doctor_rate != new_doctor_rate or old_customer_rate != new_customer_rate:
            await price_history_repo.create(db, obj_in={
                "medicine_id": med.id,
                "old_doctor_rate": old_doctor_rate,
                "new_doctor_rate": new_doctor_rate,
                "old_customer_rate": old_customer_rate,
                "new_customer_rate": new_customer_rate,
                "changed_by": changed_by
            })
            
        return med


# ==========================================
# RACK & LOCATION SERVICE
# ==========================================
class RackService:
    async def create_rack(self, db: AsyncSession, rack_in: RackCreate):
        return await rack_repo.create(db, obj_in=rack_in.model_dump())

    async def create_shelf(self, db: AsyncSession, shelf_in: ShelfCreate):
        rack = await rack_repo.get(db, shelf_in.rack_id)
        if not rack:
            raise NotFoundException("Target Rack not found")
        existing = await shelf_repo.get_by_rack_and_name(db, shelf_in.rack_id, shelf_in.name)
        if existing:
            raise BadRequestException("Shelf name already exists in this rack")
        return await shelf_repo.create(db, obj_in=shelf_in.model_dump())

    async def create_box(self, db: AsyncSession, box_in: BoxCreate):
        shelf = await shelf_repo.get(db, box_in.shelf_id)
        if not shelf:
            raise NotFoundException("Target Shelf not found")
        existing = await box_repo.get_by_shelf_and_name(db, box_in.shelf_id, box_in.name)
        if existing:
            raise BadRequestException("Box name already exists on this shelf")
        return await box_repo.create(db, obj_in=box_in.model_dump())

    async def map_batch_location(self, db: AsyncSession, mapping_in: LocationMappingCreate):
        batch = await batch_repo.get(db, mapping_in.batch_id)
        if not batch:
            raise NotFoundException("Batch not found")
        box = await box_repo.get(db, mapping_in.box_id)
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
    async def process_purchase_invoice(self, db: AsyncSession, invoice_in: PurchaseInvoiceCreate, user_id: Optional[uuid.UUID] = None) -> Sales:
        agency = await agency_repo.get(db, invoice_in.agency_id)
        if not agency:
            raise NotFoundException("Agency not found")
        
        # Check duplicate invoice
        existing = await invoice_repo.get_by_number(db, invoice_in.agency_id, invoice_in.invoice_number)
        if existing:
            raise BadRequestException(f"Invoice {invoice_in.invoice_number} already logged for this agency")

        # Create Invoice
        invoice_obj = await invoice_repo.create(db, obj_in={
            "agency_id": invoice_in.agency_id,
            "invoice_number": invoice_in.invoice_number,
            "invoice_date": invoice_in.invoice_date,
            "total_amount": invoice_in.total_amount,
            "ai_status": "COMPLETED"
        })

        for item in invoice_in.items:
            medicine = await medicine_repo.get(db, item.medicine_id)
            if not medicine:
                raise NotFoundException(f"Medicine ID {item.medicine_id} not found")

            # Create invoice log item
            await invoice_item_repo.create(db, obj_in={
                "invoice_id": invoice_obj.id,
                "medicine_id": item.medicine_id,
                "batch_number": item.batch_number,
                "quantity": item.quantity,
                "purchase_rate": item.purchase_rate,
                "expiry_date": item.expiry_date
            })

            # Check or Create Batch
            batch = await batch_repo.get_by_medicine_and_number(db, item.medicine_id, item.batch_number)
            if not batch:
                batch = await batch_repo.create(db, obj_in={
                    "medicine_id": item.medicine_id,
                    "batch_number": item.batch_number,
                    "expiry_date": item.expiry_date,
                    "mrp": medicine.mrp,  # default to current catalog mrp
                    "purchase_rate": item.purchase_rate
                })

            # Update Stock
            stock = await stock_repo.get_by_batch(db, batch.id)
            if not stock:
                old_qty = 0
                stock = await stock_repo.create(db, obj_in={
                    "batch_id": batch.id,
                    "current_stock": item.quantity,
                    "minimum_stock": 10,
                    "reorder_level": 20
                })
            else:
                old_qty = stock.current_stock
                stock.current_stock += item.quantity
                db.add(stock)

            # Log Stock Movement (Purchase)
            await stock_movement_repo.create(db, obj_in={
                "medicine_id": item.medicine_id,
                "batch_id": batch.id,
                "old_quantity": old_qty,
                "new_quantity": stock.current_stock,
                "difference": item.quantity,
                "reason": "PURCHASE",
                "user_id": user_id
            })

            # Detect purchase price change & log to history
            old_purchase_rate = medicine.current_purchase_rate
            if old_purchase_rate != item.purchase_rate:
                await purchase_history_repo.create(db, obj_in={
                    "medicine_id": item.medicine_id,
                    "agency_id": invoice_in.agency_id,
                    "invoice_id": invoice_obj.id,
                    "batch_number": item.batch_number,
                    "old_purchase_rate": old_purchase_rate,
                    "new_purchase_rate": item.purchase_rate
                })
                
                # Update medicine record purchase rate
                medicine.current_purchase_rate = item.purchase_rate
                
                # Execute Price Recommendation Algorithm
                # Retail rate: ~30% margin, Doctor rate: ~15% margin (capped at MRP)
                recommended_customer_rate = min(item.purchase_rate * 1.30, float(medicine.mrp))
                recommended_doctor_rate = min(item.purchase_rate * 1.15, float(medicine.mrp))
                
                # Apply recommendation values to active medicine pricing
                medicine.customer_selling_rate = recommended_customer_rate
                medicine.doctor_selling_rate = recommended_doctor_rate
                db.add(medicine)

        return invoice_obj

# ==========================================
# SALES TRANSACTION SERVICE
# ==========================================
class SalesService:
    async def create_sale(self, db: AsyncSession, cashier_id: uuid.UUID, sale_in: SaleCreate) -> Sales:
        total_amount = 0.0
        discount_amount = 0.0
        sale_items_data = []

        for item in sale_in.items:
            batch = await batch_repo.get(db, item.batch_id)
            if not batch:
                raise NotFoundException(f"Batch ID {item.batch_id} not found")
            
            # Fetch Stock
            stock = await stock_repo.get_by_batch(db, batch.id)
            if not stock or stock.current_stock < item.quantity:
                raise BadRequestException(f"Insufficient stock for batch {batch.batch_number}. Available: {stock.current_stock if stock else 0}")

            # Decrement Stock
            old_qty = stock.current_stock
            stock.current_stock -= item.quantity
            db.add(stock)

            # Log Stock Movement (Sale)
            await stock_movement_repo.create(db, obj_in={
                "medicine_id": batch.medicine_id,
                "batch_id": batch.id,
                "old_quantity": old_qty,
                "new_quantity": stock.current_stock,
                "difference": -item.quantity,
                "reason": "SALE",
                "user_id": cashier_id
            })

            # Pricing Calculations
            unit_price = float(batch.mrp)
            gross = unit_price * item.quantity
            net = gross - item.discount_amount
            if net < 0:
                raise BadRequestException(f"Discount exceeds items value for batch {batch.batch_number}")

            total_amount += gross
            discount_amount += item.discount_amount

            sale_items_data.append({
                "batch_id": batch.id,
                "quantity": item.quantity,
                "unit_price": unit_price,
                "discount_amount": item.discount_amount,
                "net_amount": net
            })

        # Create main Sale record
        sale = await sales_repo.create(db, obj_in={
            "cashier_id": cashier_id,
            "doctor_id": sale_in.doctor_id,
            "customer_name": sale_in.customer_name,
            "customer_phone": sale_in.customer_phone,
            "total_amount": total_amount,
            "discount_amount": discount_amount,
            "net_amount": total_amount - discount_amount,
            "payment_mode": sale_in.payment_mode
        })

        # Create individual items mapping
        for it_data in sale_items_data:
            it_data["sale_id"] = sale.id
            await sale_item_repo.create(db, obj_in=it_data)

        return sale

# ==========================================
# INVENTORY INTELLIGENCE SERVICE
# ==========================================
class IntelligenceService:
    async def calculate_inventory_metrics(self, db: AsyncSession, medicine_id: uuid.UUID) -> InventoryIntelligence:
        # Sum sale item sales for past 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        query = select(SaleItem).join(Sales).filter(
            SaleItem.batch.has(Batch.medicine_id == medicine_id),
            Sales.created_at >= thirty_days_ago
        )
        res = await db.execute(query)
        sale_items = res.scalars().all()
        
        total_sold = sum(item.quantity for item in sale_items)
        avg_monthly_sales = float(total_sold)
        
        # Calculate status
        # Fetch sum of all stocks for medicine batches
        query_stock = select(Stock).join(Batch).filter(Batch.medicine_id == medicine_id)
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

        # Suggested reorder quantity: double the average monthly sales minus current stock
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

    async def get_dead_stock_report(self, db: AsyncSession) -> List[Dict[str, Any]]:
        from sqlalchemy import func
        from app.models.all_models import Medicine, SaleItem, Sales, Batch, Stock
        
        # 1. Fetch all active medicines
        query_meds = select(Medicine).filter(Medicine.deleted_at == None)
        res_meds = await db.execute(query_meds)
        medicines = res_meds.scalars().all()
        
        dead_stock_items = []
        ninety_days_ago = datetime.utcnow() - timedelta(days=90)
        
        for med in medicines:
            # 2. Query last sale date
            query_sale = select(func.max(Sales.created_at)).join(SaleItem, Sales.id == SaleItem.sale_id).join(Batch, SaleItem.batch_id == Batch.id).filter(
                Batch.medicine_id == med.id,
                Sales.deleted_at == None
            )
            res_sale = await db.execute(query_sale)
            last_sale_date = res_sale.scalar()
            
            # 3. Sum current stock
            query_stock = select(Stock).join(Batch).filter(
                Batch.medicine_id == med.id,
                Stock.deleted_at == None
            )
            res_stock = await db.execute(query_stock)
            stocks = res_stock.scalars().all()
            
            total_stock = sum(s.current_stock for s in stocks)
            
            # Only classify as dead stock if there is physical stock on hand
            if total_stock > 0:
                is_dead = False
                if last_sale_date is None:
                    # Never sold.
                    is_dead = True
                elif last_sale_date < ninety_days_ago:
                    is_dead = True
                    
                if is_dead:
                    # Calculate stock value based on batch purchase rates
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
    async def check_expiry_dates(self, db: AsyncSession) -> List[ExpiryTracking]:
        today = date.today()
        ninety_days = today + timedelta(days=90)
        thirty_days = today + timedelta(days=30)

        # Fetch active batches (not soft deleted)
        query = select(Batch).filter(Batch.deleted_at == None)
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

            # Check if alert already logged
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
        self, db: AsyncSession, user_id: uuid.UUID, adj_in: StockAdjustmentRequest
    ) -> Stock:
        batch = await batch_repo.get(db, adj_in.batch_id)
        if not batch:
            raise NotFoundException("Batch not found")
        
        stock = await stock_repo.get_by_batch(db, batch.id)
        if not stock:
            old_qty = 0
            stock = await stock_repo.create(db, obj_in={
                "batch_id": batch.id,
                "current_stock": adj_in.new_quantity,
                "minimum_stock": 10,
                "reorder_level": 20
            })
        else:
            old_qty = stock.current_stock
            stock.current_stock = adj_in.new_quantity
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

# Instantiate service layer singletons
auth_service = AuthService()
medicine_service = MedicineService()
rack_service = RackService()
purchase_service = PurchaseService()
sales_service = SalesService()
intelligence_service = IntelligenceService()
expiry_service = ExpiryService()
inventory_service = InventoryService()


class CustomerService:
    async def create_customer(self, db: AsyncSession, customer_in: CustomerCreate):
        existing = await customer_repo.get_by_phone(db, customer_in.phone)
        if existing:
            raise BadRequestException("Customer with this phone number already registered")
        return await customer_repo.create(db, obj_in=customer_in.model_dump())

    async def update_customer(self, db: AsyncSession, customer_id: uuid.UUID, customer_in: CustomerCreate):
        cust = await customer_repo.get(db, customer_id)
        if not cust:
            raise NotFoundException("Customer not found")
        if customer_in.phone and customer_in.phone != cust.phone:
            existing = await customer_repo.get_by_phone(db, customer_in.phone)
            if existing:
                raise BadRequestException("Customer with this phone number already registered")
        update_data = customer_in.model_dump(exclude_unset=True)
        return await customer_repo.update(db, db_obj=cust, obj_in=update_data)


class SystemSettingService:
    async def get_settings(self, db: AsyncSession):
        return await setting_repo.get_singleton(db)

    async def update_settings(self, db: AsyncSession, settings_in: SystemSettingUpdate):
        setting = await setting_repo.get_singleton(db)
        update_data = settings_in.model_dump(exclude_unset=True)
        updated = await setting_repo.update(db, db_obj=setting, obj_in=update_data)
        return updated


customer_service = CustomerService()
setting_service = SystemSettingService()

