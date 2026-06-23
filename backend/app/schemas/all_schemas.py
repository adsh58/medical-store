from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator
from datetime import datetime, date
from typing import List, Optional
import uuid

# ==========================================
# 0. STORE SCHEMAS (NEW)
# ==========================================
class StoreCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class StoreResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class StoreAdminCreate(BaseModel):
    store_id: uuid.UUID
    email: EmailStr
    password: str
    full_name: str


# ==========================================
# 1. AUTHENTICATION & USER SCHEMAS
# ==========================================
class RoleResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role_name: str  # SUPER_ADMIN, ADMIN, MANAGER, CASHIER

class UserResponse(BaseModel):
    id: uuid.UUID
    store_id: Optional[uuid.UUID] = None
    email: EmailStr
    full_name: str
    is_active: bool
    role: RoleResponse
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: str  # User ID
    role: str
    exp: int


# ==========================================
# 1.3 DOCTOR SCHEMAS (BUSINESS ENTITY)
# ==========================================
class DoctorCreate(BaseModel):
    name: str
    mobile: str
    clinic_name: Optional[str] = None
    address: Optional[str] = None

class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    clinic_name: Optional[str] = None
    address: Optional[str] = None
    active: Optional[bool] = None

class DoctorResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    name: str
    mobile: str
    clinic_name: Optional[str] = None
    address: Optional[str] = None
    active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 1.4 MASTER CATALOG SCHEMAS (NEW)
# ==========================================
class MasterCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class MasterCategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class MasterMedicineCreate(BaseModel):
    category_id: uuid.UUID
    name: str
    generic_name: str
    company: str
    pack_size: str

class MasterMedicineResponse(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    name: str
    generic_name: str
    company: str
    pack_size: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 2. MEDICINES & CATEGORIES
# ==========================================
class MedicineCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class MedicineCategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class MedicineCreate(BaseModel):
    category_id: uuid.UUID
    name: str
    generic_name: str
    company: str
    pack_size: str
    mrp: float = Field(gt=0)
    current_purchase_rate: float = Field(gt=0)
    doctor_selling_rate: float = Field(gt=0)
    customer_selling_rate: float = Field(gt=0)

    @model_validator(mode="after")
    def validate_pricing_margins(self) -> 'MedicineCreate':
        if self.doctor_selling_rate < self.current_purchase_rate:
            raise ValueError("Doctor selling rate must be greater than or equal to current purchase rate")
        if self.customer_selling_rate < self.doctor_selling_rate:
            raise ValueError("Customer selling rate must be greater than or equal to doctor selling rate")
        if self.customer_selling_rate > self.mrp:
            raise ValueError("Customer selling rate must be less than or equal to Maximum Retail Price (MRP)")
        return self

class BatchStockResponse(BaseModel):
    id: uuid.UUID
    batch_number: str
    expiry_date: date
    mrp: float
    purchase_rate: float
    current_stock: int
    minimum_stock: int
    reorder_level: int
    location_coordinate: str
    model_config = ConfigDict(from_attributes=True)

class MedicineResponse(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    name: str
    generic_name: str
    company: str
    pack_size: str
    mrp: float
    current_purchase_rate: float
    doctor_selling_rate: float
    customer_selling_rate: float
    purchase_rate: float
    doctor_rate: float
    customer_rate: float
    created_at: datetime
    batches: List[BatchStockResponse] = []
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 3. RACKS & SHELVES
# ==========================================
class RackCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ShelfCreate(BaseModel):
    rack_id: uuid.UUID
    name: str
    description: Optional[str] = None

class BoxCreate(BaseModel):
    shelf_id: uuid.UUID
    name: str
    description: Optional[str] = None

class BoxResponse(BaseModel):
    id: uuid.UUID
    shelf_id: uuid.UUID
    name: str
    description: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ShelfResponse(BaseModel):
    id: uuid.UUID
    rack_id: uuid.UUID
    name: str
    description: Optional[str] = None
    boxes: List[BoxResponse] = []
    model_config = ConfigDict(from_attributes=True)

class RackResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    shelves: List[ShelfResponse] = []
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 4. AGENCIES
# ==========================================
class AgencyCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    gst_number: Optional[str] = None
    is_active: bool = True

class AgencyUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    gst_number: Optional[str] = None
    is_active: Optional[bool] = None

class AgencyResponse(BaseModel):
    id: uuid.UUID
    name: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    gst_number: Optional[str] = None
    is_active: bool
    display_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def set_display_name(cls, data: any) -> any:
        if isinstance(data, dict):
            name = data.get("name")
            city = data.get("city")
            address = data.get("address")
            if name:
                if city:
                    data["display_name"] = f"{name} ({city})"
                elif address:
                    addr_part = address.split("\n")[0].split(",")[0]
                    data["display_name"] = f"{name} - {addr_part[:40]}"
                else:
                    data["display_name"] = name
        elif hasattr(data, "name"):
            name = data.name
            city = getattr(data, "city", None)
            address = getattr(data, "address", None)
            if name:
                if city:
                    data.display_name = f"{name} ({city})"
                elif address:
                    addr_part = address.split("\n")[0].split(",")[0]
                    data.display_name = f"{name} - {addr_part[:40]}"
                else:
                    data.display_name = name
        return data


# ==========================================
# 5. BATCHES, STOCK & LOCATION
# ==========================================
class BatchCreate(BaseModel):
    medicine_id: uuid.UUID
    batch_number: str
    expiry_date: date
    mrp: float
    purchase_rate: float

class BatchResponse(BaseModel):
    id: uuid.UUID
    medicine_id: uuid.UUID
    batch_number: str
    expiry_date: date
    mrp: float
    purchase_rate: float
    location_coordinate: Optional[str] = "Unassigned"
    medicine: Optional[MedicineResponse] = None
    model_config = ConfigDict(from_attributes=True)

class StockResponse(BaseModel):
    id: uuid.UUID
    batch: BatchResponse
    current_stock: int
    minimum_stock: int
    reorder_level: int
    model_config = ConfigDict(from_attributes=True)

class StockUpdate(BaseModel):
    current_stock: int
    minimum_stock: Optional[int] = None
    reorder_level: Optional[int] = None

class LocationMappingCreate(BaseModel):
    batch_id: uuid.UUID
    box_id: uuid.UUID

class LocationMappingResponse(BaseModel):
    id: uuid.UUID
    batch_id: uuid.UUID
    box: BoxResponse
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 6. PURCHASES & INVOICES
# ==========================================
class PurchaseInvoiceItemCreate(BaseModel):
    medicine_id: uuid.UUID
    batch_number: str
    quantity: int = Field(gt=0)
    free_quantity: int = Field(default=0, ge=0)
    purchase_rate: float = Field(gt=0)
    expiry_date: date
    gst: float = Field(default=0.0, ge=0.0)

class PurchaseInvoiceCreate(BaseModel):
    agency_id: uuid.UUID
    invoice_number: str
    invoice_date: date
    total_amount: float
    items: List[PurchaseInvoiceItemCreate]

class PurchaseInvoiceItemResponse(BaseModel):
    id: uuid.UUID
    medicine_id: uuid.UUID
    batch_number: str
    quantity: int
    free_quantity: int = 0
    purchase_rate: float
    expiry_date: date
    gst: float = 0.0
    model_config = ConfigDict(from_attributes=True)

class PurchaseInvoiceResponse(BaseModel):
    id: uuid.UUID
    agency_id: uuid.UUID
    invoice_number: str
    invoice_date: date
    total_amount: float
    ai_status: str
    items: List[PurchaseInvoiceItemResponse] = []
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AIInvoiceItemCommit(BaseModel):
    medicine_id: Optional[uuid.UUID] = None
    medicine_name: str
    batch_number: str
    quantity: int = Field(gt=0)
    free_quantity: int = Field(default=0, ge=0)
    expiry_date: date
    mrp: float = Field(gt=0)
    purchase_rate: float = Field(gt=0)
    gst: float = Field(default=0.0, ge=0.0)
    doctor_rate: float = Field(gt=0)
    customer_rate: float = Field(gt=0)
    company: Optional[str] = None
    pack_size: Optional[str] = None
    generic_name: Optional[str] = None
    category_id: Optional[uuid.UUID] = None

class AIInvoiceCommitRequest(BaseModel):
    agency_id: uuid.UUID
    invoice_number: str
    invoice_date: date
    conflict_resolution: Optional[str] = None  # None, "replace", "reprocess"
    items: List[AIInvoiceItemCommit]


# ==========================================
# 7. SALES REGISTERS
# ==========================================
class SaleItemCreate(BaseModel):
    batch_id: uuid.UUID
    quantity: int = Field(gt=0)
    discount_amount: float = Field(default=0.0, ge=0)

class SaleCreate(BaseModel):
    doctor_id: Optional[uuid.UUID] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    payment_mode: str  # CASH, UPI, CARD, CREDIT
    items: List[SaleItemCreate]

class SaleItemResponse(BaseModel):
    id: uuid.UUID
    batch: BatchResponse
    quantity: int
    unit_price: float
    discount_amount: float
    net_amount: float
    model_config = ConfigDict(from_attributes=True)

class SaleResponse(BaseModel):
    id: uuid.UUID
    cashier_id: uuid.UUID
    doctor_id: Optional[uuid.UUID] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    total_amount: float
    discount_amount: float
    net_amount: float
    payment_mode: str
    items: List[SaleItemResponse] = []
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 8. HISTORICAL RECORDS
# ==========================================
class PriceHistoryResponse(BaseModel):
    id: uuid.UUID
    medicine_id: uuid.UUID
    old_doctor_rate: float
    new_doctor_rate: float
    old_customer_rate: float
    new_customer_rate: float
    changed_by: uuid.UUID
    changed_at: datetime
    model_config = ConfigDict(from_attributes=True)

class PurchaseHistoryResponse(BaseModel):
    id: uuid.UUID
    medicine_id: uuid.UUID
    agency_id: uuid.UUID
    invoice_id: uuid.UUID
    batch_number: str
    old_purchase_rate: float
    new_purchase_rate: float
    purchased_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 9. ALERTS & INTELLIGENCE
# ==========================================
class ExpiryAlertResponse(BaseModel):
    id: uuid.UUID
    batch_id: uuid.UUID
    batch: BatchResponse
    alert_date: date
    alert_type: str
    status: str
    resolved_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class IntelligenceResponse(BaseModel):
    id: uuid.UUID
    medicine_id: uuid.UUID
    avg_monthly_sales: float
    suggested_reorder_qty: int
    inventory_status: str
    last_calculated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 10. AI SCAN LOGGING
# ==========================================
class AIInvoiceProcessingLogResponse(BaseModel):
    id: uuid.UUID
    invoice_id: Optional[uuid.UUID] = None
    file_name: str
    file_size_bytes: int
    status: str
    error_message: Optional[str] = None
    token_usage_prompt: int
    token_usage_completion: int
    processed_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 11. MEDICINE SEARCH ASSISTANT
# ==========================================
class AssistantSearchRequest(BaseModel):
    query: str

class AssistantSearchItem(BaseModel):
    id: uuid.UUID
    name: str
    generic_name: str
    company: str
    pack_size: str
    mrp: float
    current_purchase_rate: float
    doctor_selling_rate: float
    customer_selling_rate: float
    matching_reason: str
    confidence: float
    batches: List[BatchStockResponse] = []

class AssistantSearchResponse(BaseModel):
    items: List[AssistantSearchItem]


# ==========================================
# 12. STOCK MOVEMENT & STAGNANCY REPORTS
# ==========================================
class StockMovementResponse(BaseModel):
    id: uuid.UUID
    medicine_id: uuid.UUID
    medicine: Optional[MedicineResponse] = None
    batch_id: uuid.UUID
    batch: Optional[BatchResponse] = None
    old_quantity: int
    new_quantity: int
    difference: int
    reason: str
    user_id: Optional[uuid.UUID] = None
    user: Optional[UserResponse] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class StockAdjustmentRequest(BaseModel):
    batch_id: uuid.UUID
    new_quantity: int = Field(ge=0)
    reason: str = Field(default="MANUAL_ADJUSTMENT")

class DeadStockResponse(BaseModel):
    medicine_id: uuid.UUID
    medicine_name: str
    generic_name: str
    company: str
    current_stock: int
    last_sale_date: Optional[datetime] = None
    stock_value: float
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 13. ADDITIONAL SCHEMAS FOR UPDATES & CRUD
# ==========================================
class MedicineUpdate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    generic_name: Optional[str] = None
    company: Optional[str] = None
    pack_size: Optional[str] = None
    mrp: Optional[float] = Field(None, gt=0)
    current_purchase_rate: Optional[float] = Field(None, gt=0)
    doctor_selling_rate: Optional[float] = Field(None, gt=0)
    customer_selling_rate: Optional[float] = Field(None, gt=0)

class UserUpdate(BaseModel):
    email: EmailStr
    full_name: str
    password: Optional[str] = None

class CustomerCreate(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None

class CustomerResponse(BaseModel):
    id: uuid.UUID
    name: str
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class SystemSettingResponse(BaseModel):
    id: uuid.UUID
    store_name: str
    currency: str
    customer_margin: float
    doctor_margin: float
    model_config = ConfigDict(from_attributes=True)

class SystemSettingUpdate(BaseModel):
    store_name: Optional[str] = None
    currency: Optional[str] = None
    customer_margin: Optional[float] = None
    doctor_margin: Optional[float] = None

class SystemLogResponse(BaseModel):
    id: uuid.UUID
    log_level: str
    module: str
    message: str
    stack_trace: Optional[str] = None
    request_path: Optional[str] = None
    request_method: Optional[str] = None
    user_id: Optional[uuid.UUID] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
