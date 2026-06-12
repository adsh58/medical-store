from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_
import uuid

from app.repositories.base import BaseRepository
from app.models.all_models import (
    Role, User, MedicineCategory, Medicine, Rack, Shelf, Box,
    Agency, PurchaseInvoice, PurchaseInvoiceItem, Batch, Stock,
    MedicineLocationMapping, Sales, SaleItem, PriceHistory,
    PurchaseHistory, InventoryIntelligence, ExpiryTracking,
    AIInvoiceProcessingLog, StockMovement
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
        ).options(selectinload(self.model.role))
        result = await db.execute(query)
        return result.scalars().first()

    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        # Include role model relation in the query load to save db roundtrips
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.email == email, 
            self.model.deleted_at == None
        ).options(selectinload(self.model.role))
        result = await db.execute(query)
        return result.scalars().first()

# ==========================================
# MEDICINES & CATEGORIES
# ==========================================
class MedicineCategoryRepository(BaseRepository[MedicineCategory]):
    async def get_by_name(self, db: AsyncSession, name: str) -> Optional[MedicineCategory]:
        query = select(self.model).filter(self.model.name == name, self.model.deleted_at == None)
        result = await db.execute(query)
        return result.scalars().first()

class MedicineRepository(BaseRepository[Medicine]):
    async def get_by_name(self, db: AsyncSession, name: str) -> Optional[Medicine]:
        query = select(self.model).filter(self.model.name == name, self.model.deleted_at == None)
        result = await db.execute(query)
        return result.scalars().first()

    async def get(self, db: AsyncSession, id: uuid.UUID) -> Optional[Medicine]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.id == id,
            self.model.deleted_at == None
        ).options(
            selectinload(self.model.batches).selectinload(Batch.stock),
            selectinload(self.model.batches).selectinload(Batch.location_mapping)
            .selectinload(MedicineLocationMapping.box).selectinload(Box.shelf).selectinload(Shelf.rack)
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def get_multi(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Medicine]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.deleted_at == None
        ).options(
            selectinload(self.model.batches).selectinload(Batch.stock),
            selectinload(self.model.batches).selectinload(Batch.location_mapping)
            .selectinload(MedicineLocationMapping.box).selectinload(Box.shelf).selectinload(Shelf.rack)
        ).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def search(self, db: AsyncSession, term: str, limit: int = 50) -> List[Medicine]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            and_(
                self.model.deleted_at == None,
                or_(
                    self.model.name.ilike(f"%{term}%"),
                    self.model.generic_name.ilike(f"%{term}%"),
                    self.model.company.ilike(f"%{term}%")
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
    async def get_layout(self, db: AsyncSession) -> List[Rack]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.deleted_at == None
        ).options(
            selectinload(self.model.shelves).selectinload(Shelf.boxes).selectinload(Box.location_mappings)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

class ShelfRepository(BaseRepository[Shelf]):
    async def get_by_rack_and_name(self, db: AsyncSession, rack_id: uuid.UUID, name: str) -> Optional[Shelf]:
        query = select(self.model).filter(
            self.model.rack_id == rack_id,
            self.model.name == name,
            self.model.deleted_at == None
        )
        result = await db.execute(query)
        return result.scalars().first()

class BoxRepository(BaseRepository[Box]):
    async def get_by_shelf_and_name(self, db: AsyncSession, shelf_id: uuid.UUID, name: str) -> Optional[Box]:
        query = select(self.model).filter(
            self.model.shelf_id == shelf_id,
            self.model.name == name,
            self.model.deleted_at == None
        )
        result = await db.execute(query)
        return result.scalars().first()

# ==========================================
# AGENCIES & PURCHASES
# ==========================================
class AgencyRepository(BaseRepository[Agency]):
    async def get_by_name(self, db: AsyncSession, name: str) -> Optional[Agency]:
        query = select(self.model).filter(self.model.name == name, self.model.deleted_at == None)
        result = await db.execute(query)
        return result.scalars().first()

class PurchaseInvoiceRepository(BaseRepository[PurchaseInvoice]):
    async def get_by_number(self, db: AsyncSession, agency_id: uuid.UUID, invoice_number: str) -> Optional[PurchaseInvoice]:
        query = select(self.model).filter(
            self.model.agency_id == agency_id,
            self.model.invoice_number == invoice_number,
            self.model.deleted_at == None
        )
        result = await db.execute(query)
        return result.scalars().first()

# ==========================================
# STOCK, BATCHES & LOCATION
# ==========================================
class BatchRepository(BaseRepository[Batch]):
    async def get_by_medicine_and_number(
        self, db: AsyncSession, medicine_id: uuid.UUID, batch_number: str
    ) -> Optional[Batch]:
        query = select(self.model).filter(
            self.model.medicine_id == medicine_id,
            self.model.batch_number == batch_number,
            self.model.deleted_at == None
        )
        result = await db.execute(query)
        return result.scalars().first()

class StockRepository(BaseRepository[Stock]):
    async def get_by_batch(self, db: AsyncSession, batch_id: uuid.UUID) -> Optional[Stock]:
        query = select(self.model).filter(self.model.batch_id == batch_id, self.model.deleted_at == None)
        result = await db.execute(query)
        return result.scalars().first()

    async def get_low_stock(self, db: AsyncSession) -> List[Stock]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.current_stock <= self.model.reorder_level,
            self.model.deleted_at == None
        ).options(selectinload(self.model.batch).selectinload(Batch.medicine))
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
    async def get_pending_alerts(self, db: AsyncSession) -> List[ExpiryTracking]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.status == "PENDING"
        ).options(selectinload(self.model.batch).selectinload(Batch.medicine))
        result = await db.execute(query)
        return list(result.scalars().all())

class AIInvoiceProcessingLogRepository(BaseRepository[AIInvoiceProcessingLog]):
    pass

# Instantiate singletons for repository instances
role_repo = RoleRepository(Role)
user_repo = UserRepository(User)
category_repo = MedicineCategoryRepository(MedicineCategory)
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

class StockMovementRepository(BaseRepository[StockMovement]):
    async def get_by_medicine(self, db: AsyncSession, medicine_id: uuid.UUID) -> List[StockMovement]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.medicine_id == medicine_id,
            self.model.deleted_at == None
        ).options(
            selectinload(self.model.batch),
            selectinload(self.model.user)
        ).order_by(self.model.created_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_all_movements(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[StockMovement]:
        from sqlalchemy.orm import selectinload
        query = select(self.model).filter(
            self.model.deleted_at == None
        ).options(
            selectinload(self.model.medicine),
            selectinload(self.model.batch),
            selectinload(self.model.user)
        ).order_by(self.model.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

stock_movement_repo = StockMovementRepository(StockMovement)
