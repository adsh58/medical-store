from sqlalchemy import String, Integer, Numeric, Boolean, Date, DateTime, ForeignKey, Text, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, date
from typing import List, Optional
import uuid

from app.database import Base

# ==========================================
# 0. STORES (MULTI-TENANCY)
# ==========================================
class Store(Base):
    __tablename__ = "stores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    users: Mapped[List["User"]] = relationship("User", back_populates="store", cascade="all, delete-orphan")
    medicines: Mapped[List["Medicine"]] = relationship("Medicine", back_populates="store", cascade="all, delete-orphan")
    customers: Mapped[List["Customer"]] = relationship("Customer", back_populates="store", cascade="all, delete-orphan")
    sales: Mapped[List["Sales"]] = relationship("Sales", back_populates="store", cascade="all, delete-orphan")
    batches: Mapped[List["Batch"]] = relationship("Batch", back_populates="store", cascade="all, delete-orphan")
    purchase_invoices: Mapped[List["PurchaseInvoice"]] = relationship("PurchaseInvoice", back_populates="store", cascade="all, delete-orphan")
    racks: Mapped[List["Rack"]] = relationship("Rack", back_populates="store", cascade="all, delete-orphan")
    doctors: Mapped[List["Doctor"]] = relationship("Doctor", back_populates="store", cascade="all, delete-orphan")
    agencies: Mapped[List["Agency"]] = relationship("Agency", back_populates="store", cascade="all, delete-orphan")
    system_settings: Mapped[List["SystemSetting"]] = relationship("SystemSetting", back_populates="store", cascade="all, delete-orphan")


# ==========================================
# 1. ROLES & USERS MODULE
# ==========================================
class Role(Base):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    users: Mapped[List["User"]] = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=True)
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    role: Mapped["Role"] = relationship("Role", back_populates="users")
    store: Mapped[Optional["Store"]] = relationship("Store", back_populates="users")
    sales_created: Mapped[List["Sales"]] = relationship("Sales", foreign_keys="[Sales.cashier_id]", back_populates="cashier")


# ==========================================
# 1.5 DOCTORS (BUSINESS ENTITY)
# ==========================================
class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    clinic_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    store: Mapped["Store"] = relationship("Store", back_populates="doctors")
    sales_referred: Mapped[List["Sales"]] = relationship("Sales", back_populates="doctor")


# ==========================================
# 2. MASTER MEDICINES & CATEGORIES
# ==========================================
class MasterCategory(Base):
    __tablename__ = "master_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    master_medicines: Mapped[List["MasterMedicine"]] = relationship("MasterMedicine", back_populates="category", cascade="all, delete-orphan")


class MasterMedicine(Base):
    __tablename__ = "master_medicines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("master_categories.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    generic_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    manufacturer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    pack_size: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    category: Mapped["MasterCategory"] = relationship("MasterCategory", back_populates="master_medicines", lazy="joined")
    store_medicines: Mapped[List["Medicine"]] = relationship("Medicine", back_populates="master_medicine", cascade="all, delete-orphan")


class Medicine(Base):
    __tablename__ = "medicines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    master_medicine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("master_medicines.id", ondelete="RESTRICT"), nullable=False)
    mrp: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    purchase_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    doctor_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    customer_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    store: Mapped["Store"] = relationship("Store", back_populates="medicines")
    master_medicine: Mapped["MasterMedicine"] = relationship("MasterMedicine", back_populates="store_medicines", lazy="joined")
    batches: Mapped[List["Batch"]] = relationship("Batch", back_populates="medicine", cascade="all, delete-orphan")
    invoice_items: Mapped[List["PurchaseInvoiceItem"]] = relationship("PurchaseInvoiceItem", back_populates="medicine", cascade="all, delete-orphan")
    price_history: Mapped[List["PriceHistory"]] = relationship("PriceHistory", back_populates="medicine", cascade="all, delete-orphan")
    purchase_history: Mapped[List["PurchaseHistory"]] = relationship("PurchaseHistory", back_populates="medicine", cascade="all, delete-orphan")
    intelligence: Mapped[Optional["InventoryIntelligence"]] = relationship("InventoryIntelligence", back_populates="medicine", uselist=False, cascade="all, delete-orphan")

    # Backward compatibility properties to prevent breaking frontend/other backend code
    @property
    def name(self) -> str:
        return self.master_medicine.name if self.master_medicine else ""

    @property
    def generic_name(self) -> str:
        return self.master_medicine.generic_name if self.master_medicine else ""

    @property
    def company(self) -> str:
        return self.master_medicine.company if self.master_medicine else ""

    @property
    def pack_size(self) -> str:
        return self.master_medicine.pack_size if self.master_medicine else ""

    @property
    def category_id(self) -> Optional[uuid.UUID]:
        return self.master_medicine.category_id if self.master_medicine else None

    @property
    def category(self) -> Optional[MasterCategory]:
        return self.master_medicine.category if self.master_medicine else None

    @property
    def current_purchase_rate(self) -> float:
        return float(self.purchase_rate)

    @property
    def doctor_selling_rate(self) -> float:
        return float(self.doctor_rate)

    @property
    def customer_selling_rate(self) -> float:
        return float(self.customer_rate)


# ==========================================
# 3. RACK, SHELF, & BOX LOCATION SYSTEM
# ==========================================
class Rack(Base):
    __tablename__ = "racks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    store: Mapped["Store"] = relationship("Store", back_populates="racks")
    shelves: Mapped[List["Shelf"]] = relationship("Shelf", back_populates="rack", cascade="all, delete-orphan")


class Shelf(Base):
    __tablename__ = "shelves"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    rack_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("racks.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    rack: Mapped["Rack"] = relationship("Rack", back_populates="shelves")
    boxes: Mapped[List["Box"]] = relationship("Box", back_populates="shelf", cascade="all, delete-orphan")
    store_relation: Mapped["Store"] = relationship("Store")


class Box(Base):
    __tablename__ = "boxes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    shelf_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shelves.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    shelf: Mapped["Shelf"] = relationship("Shelf", back_populates="boxes")
    location_mappings: Mapped[List["MedicineLocationMapping"]] = relationship("MedicineLocationMapping", back_populates="box", cascade="all, delete-orphan")
    store_relation: Mapped["Store"] = relationship("Store")


# ==========================================
# 4. PURCHASES & AGENCIES
# ==========================================
class Agency(Base):
    __tablename__ = "agencies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    store: Mapped["Store"] = relationship("Store", back_populates="agencies")
    invoices: Mapped[List["PurchaseInvoice"]] = relationship("PurchaseInvoice", back_populates="agency", cascade="all, delete-orphan")
    purchase_history: Mapped[List["PurchaseHistory"]] = relationship("PurchaseHistory", back_populates="agency", cascade="all, delete-orphan")


class PurchaseInvoice(Base):
    __tablename__ = "purchase_invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agencies.id", ondelete="RESTRICT"), nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(100), nullable=False)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    ai_status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)  # PENDING, PROCESSING, COMPLETED, FAILED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    store: Mapped["Store"] = relationship("Store", back_populates="purchase_invoices")
    agency: Mapped["Agency"] = relationship("Agency", back_populates="invoices")
    items: Mapped[List["PurchaseInvoiceItem"]] = relationship("PurchaseInvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    ai_logs: Mapped[List["AIInvoiceProcessingLog"]] = relationship("AIInvoiceProcessingLog", back_populates="invoice", cascade="all, delete-orphan")
    purchase_history: Mapped[List["PurchaseHistory"]] = relationship("PurchaseHistory", back_populates="invoice", cascade="all, delete-orphan")


class PurchaseInvoiceItem(Base):
    __tablename__ = "purchase_invoice_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_invoices.id", ondelete="CASCADE"), nullable=False)
    medicine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medicines.id", ondelete="RESTRICT"), nullable=False)
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    free_quantity: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    purchase_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    gst: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, server_default="0.0", nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    invoice: Mapped["PurchaseInvoice"] = relationship("PurchaseInvoice", back_populates="items")
    medicine: Mapped["Medicine"] = relationship("Medicine", back_populates="invoice_items")


# ==========================================
# 5. STOCK & BATCH TRACKING
# ==========================================
class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    medicine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medicines.id", ondelete="RESTRICT"), nullable=False)
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    mrp: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    purchase_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    store: Mapped["Store"] = relationship("Store", back_populates="batches")
    medicine: Mapped["Medicine"] = relationship("Medicine", back_populates="batches")
    stock: Mapped["Stock"] = relationship("Stock", back_populates="batch", uselist=False, cascade="all, delete-orphan")
    location_mapping: Mapped[Optional["MedicineLocationMapping"]] = relationship("MedicineLocationMapping", back_populates="batch", uselist=False, cascade="all, delete-orphan")
    sale_items: Mapped[List["SaleItem"]] = relationship("SaleItem", back_populates="batch", cascade="all, delete-orphan")
    expiry_alerts: Mapped[List["ExpiryTracking"]] = relationship("ExpiryTracking", back_populates="batch", cascade="all, delete-orphan")

    @property
    def current_stock(self) -> int:
        return self.stock.current_stock if self.stock else 0

    @property
    def minimum_stock(self) -> int:
        return self.stock.minimum_stock if self.stock else 10

    @property
    def reorder_level(self) -> int:
        return self.stock.reorder_level if self.stock else 20

    @property
    def location_coordinate(self) -> str:
        if self.location_mapping and self.location_mapping.box:
            box = self.location_mapping.box
            shelf = box.shelf
            rack = shelf.rack if shelf else None
            rack_name = rack.name if rack else "?"
            shelf_name = shelf.name if shelf else "?"
            box_name = box.name
            return f"{rack_name} -> {shelf_name} -> {box_name}"
        return "Unassigned"


class Stock(Base):
    __tablename__ = "stock"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("batches.id", ondelete="CASCADE"), unique=True, nullable=False)
    current_stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    minimum_stock: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    reorder_level: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="stock")
    store_relation: Mapped["Store"] = relationship("Store")


class MedicineLocationMapping(Base):
    __tablename__ = "medicine_location_mappings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("batches.id", ondelete="CASCADE"), unique=True, nullable=False)
    box_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("boxes.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="location_mapping")
    box: Mapped["Box"] = relationship("Box", back_populates="location_mappings")


# ==========================================
# 6. SALES REGISTERS
# ==========================================
class Sales(Base):
    __tablename__ = "sales"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    cashier_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True)
    customer_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    net_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(50), nullable=False)  # CASH, UPI, CARD, CREDIT
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    store: Mapped["Store"] = relationship("Store", back_populates="sales")
    cashier: Mapped["User"] = relationship("User", foreign_keys=[cashier_id], back_populates="sales_created")
    doctor: Mapped[Optional["Doctor"]] = relationship("Doctor", back_populates="sales_referred")
    items: Mapped[List["SaleItem"]] = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    sale_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sales.id", ondelete="CASCADE"), nullable=False)
    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    net_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    sale: Mapped["Sales"] = relationship("Sales", back_populates="items")
    batch: Mapped["Batch"] = relationship("Batch", back_populates="sale_items")
    store_relation: Mapped["Store"] = relationship("Store")


# ==========================================
# 7. HISTORICAL AUDITS
# ==========================================
class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medicine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False)
    old_doctor_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    new_doctor_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    old_customer_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    new_customer_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    changed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    medicine: Mapped["Medicine"] = relationship("Medicine", back_populates="price_history")


class PurchaseHistory(Base):
    __tablename__ = "purchase_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medicine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agencies.id", ondelete="RESTRICT"), nullable=False)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_invoices.id", ondelete="CASCADE"), nullable=False)
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    old_purchase_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    new_purchase_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    purchased_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    medicine: Mapped["Medicine"] = relationship("Medicine", back_populates="purchase_history")
    agency: Mapped["Agency"] = relationship("Agency", back_populates="purchase_history")
    invoice: Mapped["PurchaseInvoice"] = relationship("PurchaseInvoice", back_populates="purchase_history")


# ==========================================
# 8. ALERTS & INTELLIGENCE
# ==========================================
class InventoryIntelligence(Base):
    __tablename__ = "inventory_intelligence"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medicine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medicines.id", ondelete="CASCADE"), unique=True, nullable=False)
    avg_monthly_sales: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    suggested_reorder_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    inventory_status: Mapped[str] = mapped_column(String(50), nullable=False)  # UNDERSTOCK, NORMAL, OVERSTOCK
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    medicine: Mapped["Medicine"] = relationship("Medicine", back_populates="intelligence")


class ExpiryTracking(Base):
    __tablename__ = "expiry_tracking"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("batches.id", ondelete="CASCADE"), nullable=False)
    alert_date: Mapped[date] = mapped_column(Date, nullable=False)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)  # EXPIRY_90_DAYS, EXPIRY_30_DAYS, EXPIRED
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)  # PENDING, RESOLVED, DISMISSED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="expiry_alerts")


# ==========================================
# 9. AI SCAN LOGGING
# ==========================================
class AIInvoiceProcessingLog(Base):
    __tablename__ = "ai_invoice_processing_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("purchase_invoices.id", ondelete="SET NULL"), nullable=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # PENDING, PROCESSING, SUCCESS, FAILED
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_usage_prompt: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    token_usage_completion: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    invoice: Mapped[Optional["PurchaseInvoice"]] = relationship("PurchaseInvoice", back_populates="ai_logs")


# ==========================================
# 10. STOCK MOVEMENT LOGS
# ==========================================
class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medicine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False)
    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("batches.id", ondelete="CASCADE"), nullable=False)
    old_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    new_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    difference: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(100), nullable=False)  # PURCHASE, SALE, MANUAL_ADJUSTMENT, EXPIRY, RETURN
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    medicine: Mapped["Medicine"] = relationship("Medicine")
    batch: Mapped["Batch"] = relationship("Batch")
    user: Mapped[Optional["User"]] = relationship("User")


# ==========================================
# 11. SYSTEM SETTINGS & CUSTOMERS
# ==========================================
class SystemSetting(Base):
    __tablename__ = "system_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    store_name: Mapped[str] = mapped_column(String(255), default="Alpha Pharmacy", nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="$", nullable=False)
    customer_margin: Mapped[float] = mapped_column(Numeric(5, 2), default=30.0, nullable=False)
    doctor_margin: Mapped[float] = mapped_column(Numeric(5, 2), default=15.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    store: Mapped["Store"] = relationship("Store", back_populates="system_settings")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    store: Mapped["Store"] = relationship("Store", back_populates="customers")


class SystemLog(Base):
    __tablename__ = "system_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=True)
    log_level: Mapped[str] = mapped_column(String(50), nullable=False)
    module: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    stack_trace: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    request_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    request_method: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
