from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_
import uuid

from app.repositories.base import BaseRepository
from app.models.all_models import (
    Role, User, Store, Doctor, MasterCategory, MasterMedicine, Medicine, Rack, Shelf, Box,
    Agency, PurchaseInvoice, PurchaseInvoiceItem, Batch, Stock,
    MedicineLocationMapping, Sales, SaleItem, PriceHistory,
    PurchaseHistory, InventoryIntelligence, ExpiryTracking,
    AIInvoiceProcessingLog, StockMovement, SystemSetting, Customer
)

# ==========================================
# AUTHENTICATION & USERS
# ==========================================
class RoleRepository(BaseRepository[Role]):
    async def get_by_name(self, db: AsyncSession, name: str) -> Optional[Role]:
        query = select(self.model).filter(self.model.name == name, self.model.deleted_at == None)
        result = await db.execute(query)
        return result.scalars().first()

class UserRepository(BaseRepository[User]):
    async def get(self, db: AsyncSession, id: uuid.UUID) -> Optional[User]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.id == id,
            self.model.deleted_at == None
        ).options(selectinload(self.model.role), selectinload(self.model.store))
        result = await db.execute(query)
        return result.scalars().first()

    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.email == email, 
            self.model.deleted_at == None
        ).options(selectinload(self.model.role), selectinload(self.model.store))
        result = await db.execute(query)
        return result.scalars().first()

    async def get_multi(self, db: AsyncSession, *, skip: int = 0, limit: int = 100, store_id: Optional[uuid.UUID] = None) -> List[User]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(self.model.deleted_at == None)
        if store_id is not None:
            query = query.filter(self.model.store_id == store_id)
        query = query.options(selectinload(self.model.role)).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())


# ==========================================
# STORES & DOCTORS
# ==========================================
class StoreRepository(BaseRepository[Store]):
    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[Store]:
        query = select(self.model).filter(self.model.email == email)
        result = await db.execute(query)
        return result.scalars().first()

class DoctorRepository(BaseRepository[Doctor]):
    async def get_by_mobile(self, db: AsyncSession, mobile: str, *, store_id: uuid.UUID) -> Optional[Doctor]:
        query = select(self.model).filter(
            self.model.mobile == mobile,
            self.model.store_id == store_id
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def search(self, db: AsyncSession, query_str: str, *, store_id: uuid.UUID, limit: int = 50) -> List[Doctor]:
        query = select(self.model).filter(
            self.model.store_id == store_id,
            or_(
                self.model.name.ilike(f"%{query_str}%"),
                self.model.mobile.ilike(f"%{query_str}%"),
                self.model.clinic_name.ilike(f"%{query_str}%")
            )
        ).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())


# ==========================================
# MASTER CATALOG CATEGORIES & MEDICINES
# ==========================================
class MasterCategoryRepository(BaseRepository[MasterCategory]):
    async def get_by_name(self, db: AsyncSession, name: str) -> Optional[MasterCategory]:
        query = select(self.model).filter(self.model.name == name, self.model.deleted_at == None)
        result = await db.execute(query)
        return result.scalars().first()

class MasterMedicineRepository(BaseRepository[MasterMedicine]):
    async def get_by_name(self, db: AsyncSession, name: str) -> Optional[MasterMedicine]:
        query = select(self.model).filter(self.model.name == name, self.model.deleted_at == None)
        result = await db.execute(query)
        return result.scalars().first()


# ==========================================
# MEDICINES (STORE-SPECIFIC RATES)
# ==========================================
class MedicineRepository(BaseRepository[Medicine]):
    async def get_by_name(self, db: AsyncSession, name: str, *, store_id: uuid.UUID) -> Optional[Medicine]:
        query = select(self.model).join(self.model.master_medicine).filter(
            MasterMedicine.name == name,
            self.model.store_id == store_id,
            self.model.deleted_at == None
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def get_by_name_global(self, db: AsyncSession, name: str) -> Optional[MasterMedicine]:
        query = select(MasterMedicine).filter(MasterMedicine.name == name)
        result = await db.execute(query)
        return result.scalars().first()

    async def get(self, db: AsyncSession, id: uuid.UUID, *, store_id: Optional[uuid.UUID] = None) -> Optional[Medicine]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.id == id,
            self.model.deleted_at == None
        )
        if store_id is not None:
            query = query.filter(self.model.store_id == store_id)
        query = query.options(
            selectinload(self.model.batches).selectinload(Batch.stock),
            selectinload(self.model.batches).selectinload(Batch.location_mapping)
            .selectinload(MedicineLocationMapping.box).selectinload(Box.shelf).selectinload(Shelf.rack)
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def get_multi(self, db: AsyncSession, skip: int = 0, limit: int = 100, store_id: Optional[uuid.UUID] = None) -> List[Medicine]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.deleted_at == None
        )
        if store_id is not None:
            query = query.filter(self.model.store_id == store_id)
        query = query.options(
            selectinload(self.model.batches).selectinload(Batch.stock),
            selectinload(self.model.batches).selectinload(Batch.location_mapping)
            .selectinload(MedicineLocationMapping.box).selectinload(Box.shelf).selectinload(Shelf.rack)
        ).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def search(self, db: AsyncSession, term: str, *, store_id: uuid.UUID, limit: int = 50) -> List[Medicine]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).join(self.model.master_medicine).filter(
            and_(
                self.model.deleted_at == None,
                self.model.store_id == store_id,
                or_(
                    MasterMedicine.name.ilike(f"%{term}%"),
                    MasterMedicine.generic_name.ilike(f"%{term}%"),
                    MasterMedicine.company.ilike(f"%{term}%")
                )
            )
        ).options(
            selectinload(self.model.batches).selectinload(Batch.stock),
            selectinload(self.model.batches).selectinload(Batch.location_mapping)
            .selectinload(MedicineLocationMapping.box).selectinload(Box.shelf).selectinload(Shelf.rack)
        ).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())


# ==========================================
# RACK & SHELF
# ==========================================
class RackRepository(BaseRepository[Rack]):
    async def get_layout(self, db: AsyncSession, *, store_id: uuid.UUID) -> List[Rack]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.deleted_at == None,
            self.model.store_id == store_id
        ).options(
            selectinload(self.model.shelves).selectinload(Shelf.boxes).selectinload(Box.location_mappings)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

class ShelfRepository(BaseRepository[Shelf]):
    async def get_by_rack_and_name(self, db: AsyncSession, rack_id: uuid.UUID, name: str, *, store_id: uuid.UUID) -> Optional[Shelf]:
        query = select(self.model).filter(
            self.model.rack_id == rack_id,
            self.model.name == name,
            self.model.store_id == store_id,
            self.model.deleted_at == None
        )
        result = await db.execute(query)
        return result.scalars().first()

class BoxRepository(BaseRepository[Box]):
    async def get_by_shelf_and_name(self, db: AsyncSession, shelf_id: uuid.UUID, name: str, *, store_id: uuid.UUID) -> Optional[Box]:
        query = select(self.model).filter(
            self.model.shelf_id == shelf_id,
            self.model.name == name,
            self.model.store_id == store_id,
            self.model.deleted_at == None
        )
        result = await db.execute(query)
        return result.scalars().first()


# ==========================================
# AGENCIES & PURCHASES
# ==========================================
class AgencyRepository(BaseRepository[Agency]):
    async def get_by_name(self, db: AsyncSession, name: str, *, store_id: uuid.UUID) -> Optional[Agency]:
        query = select(self.model).filter(
            self.model.name == name,
            self.model.store_id == store_id,
            self.model.deleted_at == None
        )
        result = await db.execute(query)
        return result.scalars().first()

class PurchaseInvoiceRepository(BaseRepository[PurchaseInvoice]):
    async def get_by_number(self, db: AsyncSession, agency_id: uuid.UUID, invoice_number: str, *, store_id: uuid.UUID) -> Optional[PurchaseInvoice]:
        query = select(self.model).filter(
            self.model.agency_id == agency_id,
            self.model.invoice_number == invoice_number,
            self.model.store_id == store_id,
            self.model.deleted_at == None
        )
        result = await db.execute(query)
        return result.scalars().first()


# ==========================================
# STOCK, BATCHES & LOCATION
# ==========================================
class BatchRepository(BaseRepository[Batch]):
    async def get_by_medicine_and_number(
        self, db: AsyncSession, medicine_id: uuid.UUID, batch_number: str, *, store_id: uuid.UUID
    ) -> Optional[Batch]:
        query = select(self.model).filter(
            self.model.medicine_id == medicine_id,
            self.model.batch_number == batch_number,
            self.model.store_id == store_id,
            self.model.deleted_at == None
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def get(self, db: AsyncSession, id: uuid.UUID, *, store_id: Optional[uuid.UUID] = None) -> Optional[Batch]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.id == id,
            self.model.deleted_at == None
        )
        if store_id is not None:
            query = query.filter(self.model.store_id == store_id)
        query = query.options(
            selectinload(self.model.location_mapping).selectinload(MedicineLocationMapping.box).selectinload(Box.shelf).selectinload(Shelf.rack)
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def get_multi(self, db: AsyncSession, skip: int = 0, limit: int = 100, store_id: Optional[uuid.UUID] = None) -> List[Batch]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.deleted_at == None
        )
        if store_id is not None:
            query = query.filter(self.model.store_id == store_id)
        query = query.options(
            selectinload(self.model.location_mapping).selectinload(MedicineLocationMapping.box).selectinload(Box.shelf).selectinload(Shelf.rack)
        ).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())


class StockRepository(BaseRepository[Stock]):
    async def get_by_batch(self, db: AsyncSession, batch_id: uuid.UUID, *, store_id: uuid.UUID) -> Optional[Stock]:
        query = select(self.model).filter(
            self.model.batch_id == batch_id,
            self.model.store_id == store_id,
            self.model.deleted_at == None
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def get_low_stock(self, db: AsyncSession, *, store_id: uuid.UUID) -> List[Stock]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.current_stock <= self.model.reorder_level,
            self.model.store_id == store_id,
            self.model.deleted_at == None
        ).options(
            selectinload(self.model.batch).selectinload(Batch.medicine),
            selectinload(self.model.batch).selectinload(Batch.location_mapping).selectinload(MedicineLocationMapping.box).selectinload(Box.shelf).selectinload(Shelf.rack)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

class MedicineLocationMappingRepository(BaseRepository[MedicineLocationMapping]):
    async def get_by_batch(self, db: AsyncSession, batch_id: uuid.UUID) -> Optional[MedicineLocationMapping]:
        query = select(self.model).filter(
            self.model.batch_id == batch_id,
            self.model.deleted_at == None
        )
        result = await db.execute(query)
        return result.scalars().first()


# ==========================================
# SALES
# ==========================================
class SalesRepository(BaseRepository[Sales]):
    pass

class SaleItemRepository(BaseRepository[SaleItem]):
    pass


# ==========================================
# HISTORY & INTELLIGENCE
# ==========================================
class PriceHistoryRepository(BaseRepository[PriceHistory]):
    async def get_by_medicine(self, db: AsyncSession, medicine_id: uuid.UUID) -> List[PriceHistory]:
        query = select(self.model).filter(self.model.medicine_id == medicine_id).order_by(self.model.changed_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

class PurchaseHistoryRepository(BaseRepository[PurchaseHistory]):
    async def get_by_medicine(self, db: AsyncSession, medicine_id: uuid.UUID) -> List[PurchaseHistory]:
        query = select(self.model).filter(self.model.medicine_id == medicine_id).order_by(self.model.purchased_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

class InventoryIntelligenceRepository(BaseRepository[InventoryIntelligence]):
    async def get_by_medicine(self, db: AsyncSession, medicine_id: uuid.UUID) -> Optional[InventoryIntelligence]:
        query = select(self.model).filter(self.model.medicine_id == medicine_id)
        result = await db.execute(query)
        return result.scalars().first()

class ExpiryTrackingRepository(BaseRepository[ExpiryTracking]):
    async def get_pending_alerts(self, db: AsyncSession, *, store_id: uuid.UUID) -> List[ExpiryTracking]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).join(self.model.batch).filter(
            self.model.status == "PENDING",
            Batch.store_id == store_id
        ).options(selectinload(self.model.batch).selectinload(Batch.medicine))
        result = await db.execute(query)
        return list(result.scalars().all())

class AIInvoiceProcessingLogRepository(BaseRepository[AIInvoiceProcessingLog]):
    pass


# ==========================================
# STOCK MOVEMENT LOGS
# ==========================================
class StockMovementRepository(BaseRepository[StockMovement]):
    async def get_by_medicine(self, db: AsyncSession, medicine_id: uuid.UUID, *, store_id: uuid.UUID) -> List[StockMovement]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).join(self.model.medicine).filter(
            self.model.medicine_id == medicine_id,
            Medicine.store_id == store_id,
            self.model.deleted_at == None
        ).options(
            selectinload(self.model.batch),
            selectinload(self.model.user)
        ).order_by(self.model.created_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_all_movements(self, db: AsyncSession, skip: int = 0, limit: int = 100, store_id: Optional[uuid.UUID] = None) -> List[StockMovement]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).join(self.model.medicine).filter(
            self.model.deleted_at == None
        )
        if store_id is not None:
            query = query.filter(Medicine.store_id == store_id)
        query = query.options(
            selectinload(self.model.medicine),
            selectinload(self.model.batch),
            selectinload(self.model.user)
        ).order_by(self.model.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())


# ==========================================
# CUSTOMERS & SETTINGS
# ==========================================
class CustomerRepository(BaseRepository[Customer]):
    async def get_by_phone(self, db: AsyncSession, phone: str, *, store_id: uuid.UUID) -> Optional[Customer]:
        query = select(self.model).filter(
            self.model.phone == phone,
            self.model.store_id == store_id,
            self.model.deleted_at == None
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def get_by_phone_global(self, db: AsyncSession, phone: str, *, store_id: uuid.UUID) -> Optional[Customer]:
        query = select(self.model).filter(
            self.model.phone == phone,
            self.model.store_id == store_id
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def search(self, db: AsyncSession, query_str: str, *, store_id: uuid.UUID, limit: int = 10) -> List[Customer]:
        query = select(self.model).filter(
            self.model.deleted_at == None,
            self.model.store_id == store_id,
            or_(
                self.model.name.ilike(f"%{query_str}%"),
                self.model.phone.ilike(f"%{query_str}%")
            )
        ).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())


class SystemSettingRepository(BaseRepository[SystemSetting]):
    async def get_singleton(self, db: AsyncSession, *, store_id: uuid.UUID) -> SystemSetting:
        query = select(self.model).filter(self.model.store_id == store_id)
        result = await db.execute(query)
        setting = result.scalars().first()
        if not setting:
            setting = self.model(
                store_id=store_id,
                store_name="Adarsh Medical",
                currency="₹",
                customer_margin=30.0,
                doctor_margin=15.0
            )
            db.add(setting)
            await db.flush()
        return setting


# Instantiate singletons for repository instances
role_repo = RoleRepository(Role)
user_repo = UserRepository(User)
store_repo = StoreRepository(Store)
doctor_repo = DoctorRepository(Doctor)
category_repo = MasterCategoryRepository(MasterCategory)
master_medicine_repo = MasterMedicineRepository(MasterMedicine)
medicine_repo = MedicineRepository(Medicine)
rack_repo = RackRepository(Rack)
shelf_repo = ShelfRepository(Shelf)
box_repo = BoxRepository(Box)
agency_repo = AgencyRepository(Agency)
invoice_repo = PurchaseInvoiceRepository(PurchaseInvoice)
invoice_item_repo = BaseRepository(PurchaseInvoiceItem)
batch_repo = BatchRepository(Batch)
stock_repo = StockRepository(Stock)
location_mapping_repo = MedicineLocationMappingRepository(MedicineLocationMapping)
sales_repo = SalesRepository(Sales)
sale_item_repo = SaleItemRepository(SaleItem)
price_history_repo = PriceHistoryRepository(PriceHistory)
purchase_history_repo = PurchaseHistoryRepository(PurchaseHistory)
intelligence_repo = InventoryIntelligenceRepository(InventoryIntelligence)
expiry_repo = ExpiryTrackingRepository(ExpiryTracking)
ai_log_repo = AIInvoiceProcessingLogRepository(AIInvoiceProcessingLog)
stock_movement_repo = StockMovementRepository(StockMovement)
customer_repo = CustomerRepository(Customer)
setting_repo = SystemSettingRepository(SystemSetting)
