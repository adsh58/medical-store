"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  BarChart3, TrendingUp, AlertCircle, RefreshCw, Sparkles, 
  CheckCircle2, Ban, ShieldAlert, Calendar, LayoutGrid
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { Medicine, InventoryIntelligence, DeadStockReport, Stock, ExpiryAlert } from "@/types";
import { useCurrency } from "@/hooks/useCurrency";

interface MedicineIntelReport extends Medicine {
  intelligence?: InventoryIntelligence;
}

type TabType = "intelligence" | "dead_stock" | "low_stock" | "expiry";

export default function ReportsPage() {
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("intelligence");

  // Query 1: Inventory Intelligence
  const { data: medicines, isLoading: loadingIntel, refetch: refetchIntel } = useQuery<MedicineIntelReport[]>({
    queryKey: ["reports-intelligence"],
    enabled: activeTab === "intelligence",
    queryFn: async () => {
      const meds = await apiClient.get<Medicine[]>("/medicines").then(res => res.data);
      const list = await Promise.all(
        meds.map(async (m) => {
          try {
            const intel = await apiClient.get<InventoryIntelligence>(`/intelligence/${m.id}`).then(res => res.data);
            return { ...m, intelligence: intel };
          } catch {
            return m;
          }
        })
      );
      return list;
    }
  });

  // Query 2: Dead Stock Report
  const { data: deadStock, isLoading: loadingDead, refetch: refetchDead } = useQuery<DeadStockReport[]>({
    queryKey: ["reports-dead-stock"],
    enabled: activeTab === "dead_stock",
    queryFn: () => apiClient.get("/intelligence/reports/dead-stock").then(res => res.data)
  });

  // Query 3: Low Stock Report
  const { data: lowStock, isLoading: loadingLow, refetch: refetchLow } = useQuery<Stock[]>({
    queryKey: ["reports-low-stock"],
    enabled: activeTab === "low_stock",
    queryFn: () => apiClient.get("/inventory/stock/low").then(res => res.data)
  });

  // Query 4: Expiry Report
  const { data: expiryAlerts, isLoading: loadingExpiry, refetch: refetchExpiry } = useQuery<ExpiryAlert[]>({
    queryKey: ["reports-expiry"],
    enabled: activeTab === "expiry",
    queryFn: () => apiClient.get("/alerts/expiry").then(res => res.data)
  });

  // Mutations
  const recalculateMutation = useMutation({
    mutationFn: (medId: string) => apiClient.post(`/intelligence/recalculate/${medId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports-intelligence"] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to trigger recalculation");
    }
  });

  const handleReload = () => {
    if (activeTab === "intelligence") refetchIntel();
    else if (activeTab === "dead_stock") refetchDead();
    else if (activeTab === "low_stock") refetchLow();
    else if (activeTab === "expiry") refetchExpiry();
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-emerald-500" />
            Pharmacy Analytical Reports
          </h1>
          <p className="text-sm text-slate-500">Review stock intelligence parameters, dead inventory metrics, deficits, and batch expirations.</p>
        </div>
        <button
          onClick={handleReload}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-350 dark:hover:bg-slate-850"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reload Data
        </button>
      </div>

      {/* Tab controls */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("intelligence")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
            activeTab === "intelligence"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-550 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          Inventory Intelligence
        </button>
        <button
          onClick={() => setActiveTab("dead_stock")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
            activeTab === "dead_stock"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-550 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          Dead Stock Report (90d+)
        </button>
        <button
          onClick={() => setActiveTab("low_stock")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
            activeTab === "low_stock"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-550 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          Low Stock Deficits
        </button>
        <button
          onClick={() => setActiveTab("expiry")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
            activeTab === "expiry"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-550 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          Expiry / Expiration Audit
        </button>
      </div>

      {/* Main Grid View render based on Tab selection */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        
        {/* Tab 1: Intelligence */}
        {activeTab === "intelligence" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900/60">
                  <th className="px-6 py-4">Medicine Catalog Item</th>
                  <th className="px-6 py-4">Avg Monthly Sales (Qty)</th>
                  <th className="px-6 py-4">Suggested Reorder Qty</th>
                  <th className="px-6 py-4">Inventory Status</th>
                  <th className="px-6 py-4">Last Calculated</th>
                  <th className="px-6 py-4 text-right">Audits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {loadingIntel ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    </td>
                  </tr>
                ) : medicines && medicines.length > 0 ? (
                  medicines.map((med) => {
                    const intel = med.intelligence;
                    const isUnder = intel?.inventory_status === "UNDERSTOCK";
                    const isOver = intel?.inventory_status === "OVERSTOCK";
                    
                    return (
                      <tr key={med.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                          {med.name}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-250">
                          {intel ? intel.avg_monthly_sales : "0.00"}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-650 dark:text-slate-350">
                          {intel ? intel.suggested_reorder_qty : "0"} units
                        </td>
                        <td className="px-6 py-4">
                          {isUnder ? (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-950/20 px-2 py-1 text-xs font-semibold text-rose-400">
                              <AlertCircle className="h-3 w-3" />
                              Understock
                            </span>
                          ) : isOver ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-950/20 px-2 py-1 text-xs font-semibold text-amber-400">
                              <TrendingUp className="h-3 w-3" />
                              Overstock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-950/20 px-2 py-1 text-xs font-semibold text-emerald-455">
                              <CheckCircle2 className="h-3 w-3" />
                              Optimal
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-450">
                          {intel ? new Date(intel.last_calculated_at).toLocaleString() : "Pending computation"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => recalculateMutation.mutate(med.id)}
                            disabled={recalculateMutation.isPending}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Sparkles className="h-3 w-3 text-emerald-500" />
                            Recalculate
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      No intelligence audits loaded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Dead Stock */}
        {activeTab === "dead_stock" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900/60">
                  <th className="px-6 py-4">Medicine Item</th>
                  <th className="px-6 py-4">Generic Composition</th>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4">Stagnant Stock</th>
                  <th className="px-6 py-4">Last Sale Date</th>
                  <th className="px-6 py-4 text-right">Stock Valuation Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {loadingDead ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    </td>
                  </tr>
                ) : deadStock && deadStock.length > 0 ? (
                  deadStock.map((item) => (
                    <tr key={item.medicine_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                        {item.medicine_name}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{item.generic_name}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-450">{item.company}</td>
                      <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-250">
                        {item.current_stock} units
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-500">
                        {item.last_sale_date ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {new Date(item.last_sale_date).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-rose-500 font-semibold uppercase text-[9px] px-1.5 py-0.5 rounded bg-rose-950/20">Never Sold</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-extrabold text-slate-900 dark:text-slate-50">
                        {formatCurrency(item.stock_value)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      No stagnant dead stock detected (all items have active sales within 90 days).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Low Stock */}
        {activeTab === "low_stock" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900/60">
                  <th className="px-6 py-4">Medicine Item</th>
                  <th className="px-6 py-4">Batch Code</th>
                  <th className="px-6 py-4">Expiry Date</th>
                  <th className="px-6 py-4">Current Stock</th>
                  <th className="px-6 py-4">Reorder Safety Level</th>
                  <th className="px-6 py-4 text-right">Deficit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {loadingLow ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    </td>
                  </tr>
                ) : lowStock && lowStock.length > 0 ? (
                  lowStock.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                        {(item.batch as any).medicine?.name || "Medicine"}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-655 dark:text-slate-300">
                        {item.batch.batch_number}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {new Date(item.batch.expiry_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 font-bold text-rose-500">
                        {item.current_stock} units
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-400">
                        Reorder: {item.reorder_level} • Min: {item.minimum_stock}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-950/20 dark:text-rose-455">
                          <Ban className="h-3 w-3" />
                          Critical Deficit
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      Excellent! No inventory batches are running below safety levels.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Expiry */}
        {activeTab === "expiry" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900/60">
                  <th className="px-6 py-4">Medicine Item</th>
                  <th className="px-6 py-4">Batch Code</th>
                  <th className="px-6 py-4">Expiry Date</th>
                  <th className="px-6 py-4">Critical Threshold</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Location Coordinate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {loadingExpiry ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    </td>
                  </tr>
                ) : expiryAlerts && expiryAlerts.length > 0 ? (
                  expiryAlerts.map((alert) => {
                    const isCritical = alert.alert_type === "EXPIRED" || alert.alert_type === "EXPIRY_30_DAYS";
                    return (
                      <tr key={alert.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                          {(alert.batch as any).medicine?.name || "Medicine"}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-650 dark:text-slate-300">
                          {alert.batch.batch_number}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-200 text-xs">
                          {new Date(alert.batch.expiry_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          {isCritical ? (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-955/20 px-2.5 py-0.5 text-xs font-bold text-rose-400">
                              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                              {alert.alert_type.replace("_", " ")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-955/20 px-2.5 py-0.5 text-xs font-bold text-amber-400">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              {alert.alert_type.replace("_", " ")}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                            alert.status === "PENDING"
                              ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-450"
                              : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-450"
                          }`}>
                            {alert.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-emerald-600 dark:text-emerald-450">
                          <div className="flex items-center justify-end gap-1">
                            <LayoutGrid className="h-3.5 w-3.5 text-slate-400" />
                            {alert.batch.location_coordinate || "Unassigned"}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      No warning expiry alerts logged.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
