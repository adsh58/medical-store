"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ShoppingCart, Search, Plus, Trash2, Printer, 
  CheckCircle2, AlertCircle, RefreshCw, Sparkles, User, CreditCard
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { Medicine, User as SystemUser } from "@/types";
import { useCurrency } from "@/hooks/useCurrency";

interface CartItem {
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  mrp: number;
  purchaseRate: number;
  rateType: "retail" | "doctor" | "mrp";
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  maxStock: number;
}

export default function SalesPOSPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Checkout details
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("CASH");
  const [checkoutResult, setCheckoutResult] = useState<any>(null);

  // Centralized currency formatting
  const { currencySymbol: currency } = useCurrency();

  // Customer search states
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Customer autocomplete search query
  const { data: customerSearchResults } = useQuery<any[]>({
    queryKey: ["pos-customer-search", customerSearch],
    queryFn: () => {
      if (!customerSearch) return [];
      return apiClient.get(`/customers?search=${encodeURIComponent(customerSearch)}`).then(res => res.data);
    },
    enabled: customerSearch.length >= 3 || /^\d+$/.test(customerSearch)
  });

  // Queries
  const { data: medicines, isLoading: loadingMeds, refetch: refetchMeds } = useQuery<Medicine[]>({
    queryKey: ["pos-medicines", search],
    queryFn: () => {
      const url = search ? `/medicines?search=${encodeURIComponent(search)}` : "/medicines";
      return apiClient.get(url).then(res => res.data);
    }
  });

  const { data: doctors } = useQuery<SystemUser[]>({
    queryKey: ["pos-doctors"],
    queryFn: () => apiClient.get("/auth/doctors").then(res => res.data)
  });

  // Checkout Mutation
  const checkoutMutation = useMutation({
    mutationFn: (payload: any) => apiClient.post("/sales/", payload).then(res => res.data),
    onSuccess: (data) => {
      setCheckoutResult(data);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setSelectedDoctorId("");
      setPaymentMode("CASH");
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["recentSales"] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || err.response?.data?.detail || "Checkout transaction failed");
    }
  });

  // Cart Handlers
  const addToCart = (medicine: Medicine, batch: any, rateType: "retail" | "doctor" | "mrp") => {
    // Check if batch is already in cart
    const existingIndex = cart.findIndex(item => item.batchId === batch.id);
    if (existingIndex > -1) {
      const existing = cart[existingIndex];
      if (existing.quantity >= batch.current_stock) {
        alert("Cannot add more units. Exceeds available stock quantity.");
        return;
      }
      const newCart = [...cart];
      newCart[existingIndex] = {
        ...existing,
        quantity: existing.quantity + 1
      };
      setCart(newCart);
      return;
    }

    let unitPrice = medicine.customer_selling_rate;
    if (rateType === "doctor") unitPrice = medicine.doctor_selling_rate;
    else if (rateType === "mrp") unitPrice = medicine.mrp;

    const newItem: CartItem = {
      medicineId: medicine.id,
      medicineName: medicine.name,
      batchId: batch.id,
      batchNumber: batch.batch_number,
      expiryDate: batch.expiry_date,
      mrp: batch.mrp,
      purchaseRate: batch.purchase_rate,
      rateType,
      unitPrice,
      quantity: 1,
      discountAmount: 0,
      maxStock: batch.current_stock
    };
    setCart([...cart, newItem]);
  };

  const updateQuantity = (batchId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(batchId);
      return;
    }
    setCart(cart.map(item => {
      if (item.batchId === batchId) {
        const targetQty = Math.min(qty, item.maxStock);
        return { ...item, quantity: targetQty };
      }
      return item;
    }));
  };

  const updateDiscount = (batchId: string, disc: number) => {
    setCart(cart.map(item => {
      if (item.batchId === batchId) {
        const maxDisc = item.unitPrice * item.quantity;
        return { ...item, discountAmount: Math.min(Math.max(0, disc), maxDisc) };
      }
      return item;
    }));
  };

  const removeFromCart = (batchId: string) => {
    setCart(cart.filter(item => item.batchId !== batchId));
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert("Checkout cart is empty");
      return;
    }

    const payload = {
      doctor_id: selectedDoctorId || null,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      payment_mode: paymentMode,
      items: cart.map(item => ({
        batch_id: item.batchId,
        quantity: item.quantity,
        discount_amount: item.discountAmount
      }))
    };

    checkoutMutation.mutate(payload);
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const totalDiscount = cart.reduce((sum, item) => sum + item.discountAmount, 0);
  const netPayable = Math.max(0, subtotal - totalDiscount);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-emerald-500" />
          POS Checkout Sales Register
        </h1>
        <p className="text-sm text-slate-500">Record cashier checkouts, reference doctors, apply checkout discounts, and decrement stock.</p>
      </div>

      {/* Main Split Layout */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        
        {/* Left Side: Search & Catalog */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              Medicine & Batch Selection
            </h2>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search catalog by name, generic description..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-4 pl-10 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900"
                />
              </div>
              <button
                onClick={() => refetchMeds()}
                className="flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-350 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* Catalog list */}
            <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
              {loadingMeds ? (
                <div className="py-12 text-center">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                </div>
              ) : medicines && medicines.length > 0 ? (
                medicines.map((med) => {
                  const availableBatches = med.batches?.filter(b => b.current_stock > 0) ?? [];
                  return (
                    <div key={med.id} className="border border-slate-150 dark:border-slate-800/80 rounded-lg p-3 bg-slate-50/20 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{med.name}</h3>
                          <p className="text-xs text-slate-400">{med.generic_name} • {med.company}</p>
                        </div>
                        <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                          <p>Customer: <strong className="text-emerald-500">{currency}{med.customer_selling_rate.toFixed(2)}</strong></p>
                          <p>Doctor: <strong>{currency}{med.doctor_selling_rate.toFixed(2)}</strong></p>
                          <p>MRP: <strong>{currency}{med.mrp.toFixed(2)}</strong></p>
                        </div>
                      </div>

                      {/* Batches available in stock */}
                      <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/60 pt-2">
                        {availableBatches.length > 0 ? (
                          availableBatches.map((batch) => (
                            <div key={batch.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded bg-white dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 text-xs">
                              <div>
                                <span className="font-bold text-slate-700 dark:text-slate-200">Batch: {batch.batch_number}</span>
                                <span className="mx-2 text-slate-300">|</span>
                                <span className="text-slate-400">Stock: <strong className="text-slate-600 dark:text-slate-300">{batch.current_stock}</strong></span>
                                <span className="mx-2 text-slate-300">|</span>
                                <span className="text-slate-450">Exp: {new Date(batch.expiry_date).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                <button
                                  onClick={() => addToCart(med, batch, "retail")}
                                  className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded font-semibold hover:bg-emerald-100 dark:bg-emerald-950/25 dark:text-emerald-400"
                                >
                                  + Retail
                                </button>
                                <button
                                  onClick={() => addToCart(med, batch, "doctor")}
                                  className="px-2 py-1 bg-blue-50 text-blue-600 rounded font-semibold hover:bg-blue-100 dark:bg-blue-950/25 dark:text-blue-400"
                                >
                                  + Doctor
                                </button>
                                <button
                                  onClick={() => addToCart(med, batch, "mrp")}
                                  className="px-2 py-1 bg-slate-100 text-slate-600 rounded font-semibold hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  + MRP
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Out of stock. No active batches recorded.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">No medicines match your search.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Cart & Checkout Form */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
              <span>Checkout Checkout Basket</span>
              <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {cart.length} items
              </span>
            </h2>

            {/* Cart Table List */}
            {cart.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[250px] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.batchId} className="py-3 flex flex-col gap-2 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200">{item.medicineName}</h4>
                        <p className="text-[10px] text-slate-400">Batch: {item.batchNumber} • Rate: <span className="uppercase font-bold text-[9px] px-1 rounded bg-slate-100 dark:bg-slate-850 dark:text-slate-350">{item.rateType}</span></p>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.batchId)}
                        className="text-slate-450 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex justify-between items-center gap-3">
                      {/* Qty edit */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Qty:</span>
                        <button
                          onClick={() => updateQuantity(item.batchId, item.quantity - 1)}
                          className="w-5 h-5 flex items-center justify-center rounded border border-slate-200 dark:border-slate-850 hover:bg-slate-50 font-bold"
                        >
                          -
                        </button>
                        <span className="font-bold text-slate-700 dark:text-slate-200 w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.batchId, item.quantity + 1)}
                          className="w-5 h-5 flex items-center justify-center rounded border border-slate-200 dark:border-slate-850 hover:bg-slate-50 font-bold"
                        >
                          +
                        </button>
                        <span className="text-[10px] text-slate-400">/ {item.maxStock} max</span>
                      </div>

                      {/* Discount amount input */}
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Discount:</span>
                        <div className="relative">
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-400">{currency}</span>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={item.discountAmount || ""}
                            onChange={(e) => updateDiscount(item.batchId, parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-16 rounded border border-slate-200 bg-white p-1 pl-4 text-xs dark:border-slate-850 dark:bg-slate-950"
                          />
                        </div>
                      </div>

                      {/* Total */}
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 line-through">{currency}{(item.unitPrice * item.quantity).toFixed(2)}</p>
                        <p className="font-semibold text-slate-900 dark:text-slate-50">
                          {currency}{((item.unitPrice * item.quantity) - item.discountAmount).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-center text-slate-400 text-xs">
                Checkout cart is empty. Add medicine batches from the left panel.
              </div>
            )}

            {/* Customer information */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer & Referral Details</h3>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search registered customer (Name/Mobile)..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full rounded border border-slate-200 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                />
                
                {showCustomerDropdown && customerSearch && customerSearchResults && customerSearchResults.length > 0 && (
                  <div className="absolute z-15 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950 max-h-48 overflow-y-auto">
                    {customerSearchResults.map((cust: any) => (
                      <div
                        key={cust.id}
                        onClick={() => {
                          setCustomerName(cust.name);
                          setCustomerPhone(cust.phone);
                          setCustomerSearch(cust.name);
                          setShowCustomerDropdown(false);
                        }}
                        className="cursor-pointer px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-350 dark:hover:bg-slate-850 flex justify-between"
                      >
                        <span className="font-semibold">{cust.name}</span>
                        <span className="text-slate-400">{cust.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Customer Name (Optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded border border-slate-200 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                />
                <input
                  type="text"
                  placeholder="Customer Phone (Optional)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full rounded border border-slate-200 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              {/* Referrer Doctor */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Referring Doctor
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full rounded border border-slate-200 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="">No Doctor Referral</option>
                  {doctors?.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Payment Mode */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  Payment Mode Selection
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {["CASH", "UPI", "CARD", "CREDIT"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPaymentMode(mode)}
                      className={`py-1.5 rounded text-[10px] font-bold tracking-wider text-center border transition-all ${
                        paymentMode === mode
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pricing breakdown summary */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Total Items Subtotal:</span>
                <span>{currency}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Discounts Subtractions:</span>
                <span className="text-rose-500">-{currency}{totalDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 text-sm border-t border-slate-100 dark:border-slate-800/80 pt-2">
                <span>Net Payable Amount:</span>
                <span className="text-emerald-500">{currency}{netPayable.toFixed(2)}</span>
              </div>
            </div>

            {/* Complete checkout button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || checkoutMutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
            >
              {checkoutMutation.isPending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Process & Complete checkout
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Success Modal Receipt */}
      {checkoutResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            
            {/* Modal Header */}
            <div className="text-center space-y-1">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">Transaction Completed!</h3>
              <p className="text-xs text-slate-400">Invoice ID: {checkoutResult.id}</p>
            </div>

            {/* Invoice Print Layout container */}
            <div id="printable-receipt" className="p-4 border border-slate-100 dark:border-slate-800 rounded-lg space-y-4 text-xs font-mono text-slate-800 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-950/40">
              <div className="text-center border-b border-dashed border-slate-200 dark:border-slate-800 pb-2">
                <h4 className="font-bold uppercase tracking-widest text-sm">VISHAL MEDICAL STORE</h4>
                <p className="text-[10px] text-slate-400">Emergency Absentee Cashier Desk</p>
                <p className="text-[10px] text-slate-400">Date: {new Date(checkoutResult.created_at).toLocaleString()}</p>
              </div>

              {/* Customer details */}
              <div className="space-y-0.5 border-b border-dashed border-slate-200 dark:border-slate-800 pb-2">
                <p><strong>Customer:</strong> {checkoutResult.customer_name || "General Walk-in"}</p>
                {checkoutResult.customer_phone && <p><strong>Phone:</strong> {checkoutResult.customer_phone}</p>}
                {checkoutResult.payment_mode && <p><strong>Pay Mode:</strong> {checkoutResult.payment_mode}</p>}
              </div>

              {/* Items Table */}
              <div className="space-y-1">
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1 font-bold">
                  <span>Item [Batch]</span>
                  <span>Qty * Rate</span>
                  <span>Net</span>
                </div>
                {checkoutResult.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-[11px]">
                    <div className="truncate max-w-[150px]">
                      {item.batch?.medicine?.name || "Medicine"} <span className="text-[9px] text-slate-400">[{item.batch?.batch_number}]</span>
                    </div>
                    <span>{item.quantity} * {currency}{item.unit_price.toFixed(2)}</span>
                    <span>{currency}{item.net_amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-2 space-y-1 text-right font-bold">
                <div className="flex justify-between text-slate-450">
                  <span>Gross Subtotal:</span>
                  <span>{currency}{checkoutResult.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-450">
                  <span>Total Discount:</span>
                  <span>-{currency}{checkoutResult.discount_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-900 dark:text-slate-50 border-t border-slate-200 dark:border-slate-800 pt-1 text-sm">
                  <span>Net Paid:</span>
                  <span>{currency}{checkoutResult.net_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const printContent = document.getElementById("printable-receipt")?.innerHTML;
                  const originalContent = document.body.innerHTML;
                  if (printContent) {
                    const printWindow = window.open("", "_blank");
                    printWindow?.document.write(`
                      <html>
                        <head>
                          <title>Receipt Print</title>
                          <style>
                            body { font-family: monospace; padding: 20px; color: #000; }
                            .text-center { text-align: center; }
                            .uppercase { text-transform: uppercase; }
                            .flex { display: flex; justify-content: space-between; }
                            .border-b { border-bottom: 1px solid #000; }
                            .border-t { border-top: 1px solid #000; }
                            .pb-2 { padding-bottom: 8px; }
                            .pb-1 { padding-bottom: 4px; }
                            .pt-2 { padding-top: 8px; }
                            .pt-1 { padding-top: 4px; }
                            .font-bold { font-weight: bold; }
                          </style>
                        </head>
                        <body>
                          ${printContent}
                        </body>
                      </html>
                    `);
                    printWindow?.document.close();
                    printWindow?.print();
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-350"
              >
                <Printer className="h-4 w-4" />
                Print Receipt
              </button>
              <button
                onClick={() => setCheckoutResult(null)}
                className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-500"
              >
                New Checkout Transaction
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
