"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowLeft, Pill, TrendingUp, Calendar, AlertTriangle, 
  MapPin, DollarSign, Activity, FileText, User
} from "lucide-react";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import { Medicine } from "@/types";

interface PriceHistoryEntry {
  id: string;
  medicine_id: string;
  old_doctor_rate: number;
  new_doctor_rate: number;
  old_customer_rate: number;
  new_customer_rate: number;
  changed_by: string;
  changed_at: string;
}

export default function MedicineDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);

  // Dynamic currency query
  const { data: settingsData } = useQuery<any>({
    queryKey: ["system-settings"],
    queryFn: () => apiClient.get("/settings").then(res => res.data)
  });
  const currency = settingsData?.currency || "$";

  // Queries
  const { data: medicine, isLoading: loadingMed, error: medError } = useQuery<Medicine>({
    queryKey: ["medicine-detail", id],
    queryFn: () => apiClient.get(`/medicines/${id}`).then(res => res.data)
  });

  const { data: priceHistory, isLoading: loadingHistory } = useQuery<PriceHistoryEntry[]>({
    queryKey: ["medicine-price-history", id],
    queryFn: () => apiClient.get(`/medicines/${id}/price-history`).then(res => res.data)
  });

  if (loadingMed) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (medError || !medicine) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-6 text-center text-rose-650 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-400">
        <AlertTriangle className="mx-auto h-12 w-12 text-rose-500 mb-3" />
        <h3 className="text-lg font-bold">Failed to load medicine</h3>
        <p className="text-sm mt-1 mb-4">The pharmaceutical record could not be fetched or does not exist.</p>
        <Link href="/medicines" className="inline-flex items-center gap-1.5 text-xs font-bold underline">
          <ArrowLeft className="h-4 w-4" /> Back to Catalog
        </Link>
      </div>
    );
  }

  // Statistics calculations
  const totalStock = medicine.batches?.reduce((sum, b) => sum + b.current_stock, 0) ?? 0;
  const marginPercentage = medicine.current_purchase_rate > 0 
    ? ((medicine.customer_selling_rate - medicine.current_purchase_rate) / medicine.current_purchase_rate) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link 
            href="/medicines" 
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Medicines Catalog
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Pill className="h-6 w-6 text-emerald-500" />
            {medicine.name}
          </h1>
          <p className="text-sm text-slate-400 font-medium">{medicine.generic_name} • {medicine.company}</p>
        </div>
        
        {/* Margin badge */}
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 border border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/50">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <div className="text-left">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Estimated Profit Margin</p>
            <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-450">+{marginPercentage.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Grid panels */}
      <div className="grid gap-6 md:grid-cols-3">
        
        {/* Panel 1: Master price details */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            Master Rate Card Details
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Retail Customer Rate:</span>
              <strong className="text-emerald-500 text-sm">{currency}{medicine.customer_selling_rate.toFixed(2)}</strong>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Doctor Rate:</span>
              <strong className="text-slate-800 dark:text-slate-200 text-sm">{currency}{medicine.doctor_selling_rate.toFixed(2)}</strong>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Current Purchase Rate:</span>
              <strong className="text-slate-850 dark:text-slate-350">{currency}{medicine.current_purchase_rate.toFixed(2)}</strong>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Maximum Retail Price (MRP):</span>
              <strong className="text-slate-700 dark:text-slate-200">{currency}{medicine.mrp.toFixed(2)}</strong>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Standard Pack Size:</span>
              <span className="font-semibold text-slate-600 dark:text-slate-400">{medicine.pack_size}</span>
            </div>
          </div>
        </div>

        {/* Panel 2: Physical inventory summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-emerald-500" />
            Physical Inventory Summary
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Total Available Stock:</span>
              <span className={`font-extrabold ${totalStock === 0 ? "text-rose-500" : "text-slate-800 dark:text-slate-100"}`}>
                {totalStock} units
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Tracked Batches:</span>
              <span className="font-semibold">{medicine.batches?.length ?? 0} active</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Safety Threshold Limits:</span>
              <span>Min: 10 • Reorder: 25</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Date Added:</span>
              <span className="font-semibold">{new Date(medicine.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Panel 3: Quick operations description */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 text-xs text-slate-500">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-emerald-500" />
            Pharmacist Dispensing Instructions
          </h2>
          <p className="leading-relaxed">
            Ensure the customer rate is checked against doctor prescription parameters before checkouts. 
            For bulk orders refer to the Doctor Rate option inside the POS panel.
          </p>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <Link 
              href="/sales"
              className="flex-1 text-center py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[10px] uppercase tracking-wider transition-colors"
            >
              Checkout POS
            </Link>
            <Link 
              href="/inventory"
              className="flex-1 text-center py-2 border border-slate-200 hover:bg-slate-50 dark:border-slate-850 dark:hover:bg-slate-850 font-bold rounded text-[10px] uppercase tracking-wider transition-colors"
            >
              Adjust Stock
            </Link>
          </div>
        </div>

      </div>

      {/* Grid: Batches & Price History list */}
      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* Active Batches */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Physical Stock Batches</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-2.5">Batch Code</th>
                  <th className="py-2.5">Stock</th>
                  <th className="py-2.5">Expiry Date</th>
                  <th className="py-2.5">Location Coordinate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {medicine.batches && medicine.batches.length > 0 ? (
                  medicine.batches.map((batch) => {
                    const isLow = batch.current_stock <= batch.reorder_level;
                    return (
                      <tr key={batch.id} className="hover:bg-slate-50/20">
                        <td className="py-3 font-semibold text-slate-900 dark:text-slate-100">{batch.batch_number}</td>
                        <td className={`py-3 font-bold ${isLow ? "text-amber-500" : "text-slate-700 dark:text-slate-300"}`}>
                          {batch.current_stock} units
                        </td>
                        <td className="py-3 font-medium text-slate-500">
                          {new Date(batch.expiry_date).toLocaleDateString()}
                        </td>
                        <td className="py-3 font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {batch.location_coordinate || "Unassigned"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No stock batches recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Price history logs */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Rate Change Audit Trail</h3>
          
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-2.5">Timestamp</th>
                  <th className="py-2.5">Retail Rate (Old → New)</th>
                  <th className="py-2.5">Doctor Rate (Old → New)</th>
                  <th className="py-2.5">Audit Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center">
                      <div className="mx-auto h-4 w-4 animate-spin rounded-full border border-emerald-500 border-t-transparent" />
                    </td>
                  </tr>
                ) : priceHistory && priceHistory.length > 0 ? (
                  priceHistory.map((history) => (
                    <tr key={history.id} className="hover:bg-slate-50/20 text-[11px]">
                      <td className="py-3 font-medium text-slate-450 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(history.changed_at).toLocaleString()}
                      </td>
                      <td className="py-3 font-medium text-slate-750 dark:text-slate-200">
                        {currency}{history.old_customer_rate.toFixed(2)} → <strong className="text-emerald-600 dark:text-emerald-400">{currency}{history.new_customer_rate.toFixed(2)}</strong>
                      </td>
                      <td className="py-3 font-medium text-slate-750 dark:text-slate-200">
                        {currency}{history.old_doctor_rate.toFixed(2)} → <strong>{currency}{history.new_doctor_rate.toFixed(2)}</strong>
                      </td>
                      <td className="py-3 font-medium text-slate-500 flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" />
                        System Operator
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No price audit adjustments recorded. Rates are at factory defaults.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
