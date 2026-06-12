"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, RefreshCw, CircleAlert, Grid, Check, History, Edit2, X } from "lucide-react";
import apiClient from "@/lib/api-client";
import { Stock } from "@/types";
import Link from "next/link";

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [targetBoxId, setTargetBoxId] = useState<string>("");

  // Adjustment state
  const [adjustingStockId, setAdjustingStockId] = useState<string | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>("MANUAL_ADJUSTMENT");

  // Queries
  const { data: stockItems, isLoading, refetch } = useQuery<Stock[]>({
    queryKey: ["stock"],
    queryFn: () => apiClient.get("/inventory/stock").then(res => res.data)
  });

  const { data: boxes } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["boxes-list"],
    queryFn: () => apiClient.get("/racks/layout").then(res => {
      // Flatten boxes from racks layout
      const list: { id: string; name: string }[] = [];
      res.data.forEach((rack: any) => {
        rack.shelves?.forEach((shelf: any) => {
          shelf.boxes?.forEach((box: any) => {
            list.push({
              id: box.id,
              name: `${rack.name} -> ${shelf.name} -> ${box.name}`
            });
          });
        });
      });
      return list;
    }).catch(() => [
      { id: "b1", name: "Rack A -> Shelf A1 -> Box 1" },
      { id: "b2", name: "Rack A -> Shelf A2 -> Box 1" },
      { id: "b3", name: "Rack B -> Shelf B1 -> Box 1" },
    ])
  });

  // Mutations
  const mapLocationMutation = useMutation({
    mutationFn: (data: { batch_id: string; box_id: string }) => apiClient.post("/racks/map-location", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      setSelectedStockId(null);
      setTargetBoxId("");
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to update location");
    }
  });

  const adjustStockMutation = useMutation({
    mutationFn: (data: { batch_id: string; new_quantity: number; reason: string }) =>
      apiClient.post("/inventory/stock/adjust", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      setAdjustingStockId(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to adjust stock level");
    }
  });

  const handleMapLocation = (batchId: string) => {
    if (!targetBoxId) return;
    mapLocationMutation.mutate({ batch_id: batchId, box_id: targetBoxId });
  };

  const handleAdjustStock = (batchId: string) => {
    adjustStockMutation.mutate({
      batch_id: batchId,
      new_quantity: adjustmentQty,
      reason: adjustmentReason
    });
  };

  const startAdjustment = (item: Stock) => {
    setAdjustingStockId(item.id);
    setAdjustmentQty(item.current_stock);
    setAdjustmentReason("MANUAL_ADJUSTMENT");
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Stock Inventory</h1>
          <p className="text-sm text-slate-500">Track batch quantities, expiry dates, and assign storage grid coordinate box maps.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/inventory/history"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <History className="h-3.5 w-3.5 text-emerald-500" />
            View Stock Ledger
          </Link>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload List
          </button>
        </div>
      </div>

      {/* Grid listing */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-6 py-4">Medicine Info</th>
                <th className="px-6 py-4">Batch Number</th>
                <th className="px-6 py-4">Expiry Date</th>
                <th className="px-6 py-4">Current Stock</th>
                <th className="px-6 py-4">Min Stock</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Coordinate Maps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  </td>
                </tr>
              ) : stockItems && stockItems.length > 0 ? (
                stockItems.map((item) => {
                  const isLow = item.current_stock <= item.reorder_level;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                        {(item.batch as any).medicine?.name || "Paracetamol 650mg"}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-650 dark:text-slate-300">
                        {item.batch.batch_number}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-350">
                        {new Date(item.batch.expiry_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {adjustingStockId === item.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={adjustmentQty}
                              onChange={(e) => setAdjustmentQty(parseInt(e.target.value) || 0)}
                              className="w-16 rounded border border-slate-200 bg-white p-1 text-xs outline-none dark:border-slate-800 dark:bg-slate-900"
                            />
                            <select
                              value={adjustmentReason}
                              onChange={(e) => setAdjustmentReason(e.target.value)}
                              className="rounded border border-slate-200 bg-white p-1 text-xs outline-none dark:border-slate-800 dark:bg-slate-900"
                            >
                              <option value="MANUAL_ADJUSTMENT">Manual</option>
                              <option value="EXPIRY">Expiry</option>
                              <option value="RETURN">Return</option>
                              <option value="DAMAGE">Damage</option>
                            </select>
                            <button
                              onClick={() => handleAdjustStock(item.batch.id)}
                              className="rounded bg-emerald-600 p-1 text-white hover:bg-emerald-500 animate-pulse"
                              title="Save stock adjustment"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setAdjustingStockId(null)}
                              className="rounded bg-slate-200 p-1 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400"
                              title="Cancel"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${isLow ? "text-amber-500" : "text-slate-900 dark:text-slate-100"}`}>
                              {item.current_stock}
                            </span>
                            <button
                              onClick={() => startAdjustment(item)}
                              className="text-slate-400 hover:text-emerald-500 transition-colors"
                              title="Adjust stock quantity"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-400">{item.minimum_stock}</td>
                      <td className="px-6 py-4 font-medium text-slate-655 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <Grid className="h-3 w-3" />
                          {item.batch.location_coordinate || "Unassigned"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-600 dark:bg-amber-950/20 dark:text-amber-400">
                            <CircleAlert className="h-3 w-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {selectedStockId === item.id ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <select
                              value={targetBoxId}
                              onChange={(e) => setTargetBoxId(e.target.value)}
                              className="rounded border border-slate-200 bg-white p-1 text-xs dark:border-slate-800 dark:bg-slate-900"
                            >
                              <option value="">Select Box</option>
                              {boxes?.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleMapLocation(item.batch.id)}
                              className="rounded bg-emerald-600 p-1 text-white hover:bg-emerald-500"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setSelectedStockId(null)}
                              className="rounded bg-slate-200 p-1 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedStockId(item.id)}
                            className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            Assign Box
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No stock inventory logs mapped.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
