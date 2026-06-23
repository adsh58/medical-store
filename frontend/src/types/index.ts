export interface Role {
  id: string;
  name: string;
  description?: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserCreate {
  email: string;
  password: string;
  full_name: string;
  role_name: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  role: Role;
  created_at: string;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface MedicineCategory {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface BatchStock {
  id: string;
  batch_number: string;
  expiry_date: string;
  mrp: number;
  purchase_rate: number;
  current_stock: number;
  minimum_stock: number;
  reorder_level: number;
  location_coordinate: string;
}

export interface Medicine {
  id: string;
  category_id: string;
  name: string;
  generic_name: string;
  company: string;
  pack_size: string;
  mrp: number;
  current_purchase_rate: number;
  doctor_selling_rate: number;
  customer_selling_rate: number;
  created_at: string;
  batches?: BatchStock[];
}

export interface MedicineCreate {
  category_id: string;
  name: string;
  generic_name: string;
  company: string;
  pack_size: string;
  mrp: number;
  current_purchase_rate: number;
  doctor_selling_rate: number;
  customer_selling_rate: number;
}

export interface Box {
  id: string;
  shelf_id: string;
  name: string;
  description?: string;
}

export interface Shelf {
  id: string;
  rack_id: string;
  name: string;
  description?: string;
  boxes?: Box[];
}

export interface Rack {
  id: string;
  name: string;
  description?: string;
  shelves: Shelf[];
}

export interface Agency {
  id: string;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  gst_number?: string;
  is_active: boolean;
  display_name?: string;
}

export interface PurchaseInvoiceItem {
  id: string;
  medicine_id: string;
  batch_number: string;
  quantity: number;
  purchase_rate: number;
  expiry_date: string;
}

export interface PurchaseInvoice {
  id: string;
  agency_id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  ai_status: string;
  items: PurchaseInvoiceItem[];
  created_at: string;
}

export interface Batch {
  id: string;
  medicine_id: string;
  batch_number: string;
  expiry_date: string;
  mrp: number;
  purchase_rate: number;
  location_coordinate?: string;
  medicine?: Medicine;
}

export interface Stock {
  id: string;
  batch: Batch;
  current_stock: number;
  minimum_stock: number;
  reorder_level: number;
}

export interface MedicineLocationMapping {
  id: string;
  batch_id: string;
  shelf: Shelf;
}

export interface SaleItem {
  id: string;
  batch: Batch;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  net_amount: number;
}

export interface Sale {
  id: string;
  cashier_id: string;
  doctor_id?: string;
  customer_name?: string;
  customer_phone?: string;
  total_amount: number;
  discount_amount: number;
  net_amount: number;
  payment_mode: string;
  items: SaleItem[];
  created_at: string;
}

export interface ExpiryAlert {
  id: string;
  batch_id: string;
  batch: Batch;
  alert_date: string;
  alert_type: "EXPIRY_90_DAYS" | "EXPIRY_30_DAYS" | "EXPIRED";
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  resolved_at?: string;
}

export interface InventoryIntelligence {
  id: string;
  medicine_id: string;
  avg_monthly_sales: number;
  suggested_reorder_qty: number;
  inventory_status: "UNDERSTOCK" | "NORMAL" | "OVERSTOCK";
  last_calculated_at: string;
}

export interface AIInvoiceComparisonItem {
  medicine_id?: string;
  medicine_name: string;
  pack_size: string;
  batch_no: string;
  expiry_date: string;
  quantity: number;
  new_rate: number;
  old_rate: number;
  difference_percentage: number;
  trend: "INCREASED" | "DECREASED" | "UNCHANGED" | "NEW_MEDICINE";
  alert_triggered: boolean;
  alert_message?: string;
  recommended_doctor_rate: number;
  recommended_customer_rate: number;
}

export interface AIInvoiceAnalysisReport {
  file_name: string;
  extracted_items: AIInvoiceComparisonItem[];
  total_increases: number;
  total_decreases: number;
}

export interface AssistantSearchItem {
  id: string;
  name: string;
  generic_name: string;
  company: string;
  pack_size: string;
  mrp: number;
  current_purchase_rate: number;
  doctor_selling_rate: number;
  customer_selling_rate: number;
  matching_reason: string;
  confidence: number;
  batches?: BatchStock[];
}

export interface AssistantSearchResponse {
  items: AssistantSearchItem[];
}

export interface StockMovement {
  id: string;
  medicine_id: string;
  medicine?: Medicine;
  batch_id: string;
  batch?: Batch;
  old_quantity: number;
  new_quantity: number;
  difference: number;
  reason: string;
  user_id?: string;
  user?: User;
  created_at: string;
}

export interface DeadStockReport {
  medicine_id: string;
  medicine_name: string;
  generic_name: string;
  company: string;
  current_stock: number;
  last_sale_date?: string;
  stock_value: number;
}
