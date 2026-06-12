"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { History, RefreshCw, ArrowUpRight, ArrowDownRight, User as UserIcon, Calendar, Pill } from "lucide-react";
import apiClient from "@/lib/api-client";
import { StockMovement } from "@/types";
import Link from "next/link";

export default function StockHistoryPage() {
  // Query to fetch all movements
  const { data: movements, isLoading, refetch } = useQuery<StockMovement[]>({
    queryKey: ["stock-movements"],
    queryFn: () => apiClient.get("/inventory/stock/movements").then(res => res.data)
  });

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <History className="h-6 w-6 text-emerald-500" />
            Inventory Stock Ledger
          </h1>
          <p className="text-sm text-slate-500">Audit trail of all stock changes (purchases, sales, manual adjustments, expiries, returns).</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/inventory"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-655 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Back to Inventory
          </Link>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload Ledger
          </button>
        </div>
      </div>

      {/* Grid listing */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Medicine Name</th>
                <th className="px-6 py-4">Batch Info</th>
                <th className="px-6 py-4">Old Qty</th>
                <th className="px-6 py-4">New Qty</th>
                <th className="px-6 py-4">Adjustment</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  </td>
                </tr>
              ) : movements && movements.length > 0 ? (
                movements.map((log) => {
                  const isPositive = log.difference > 0;
                  const formattedDate = new Date(log.created_at).toLocaleString();
                  
                  // Color badges for reasons
                  let reasonBadge = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
                  if (log.reason === "PURCHASE") {
                    reasonBadge = "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-450";
                  } else if (log.reason === "SALE") {
                    reasonBadge = "bg-teal-50 text-teal-600 dark:bg-teal-950/20 dark:text-teal-400";
                  } else if (log.reason === "EXPIRY") {
                    reasonBadge = "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400";
                  } else if (log.reason === "MANUAL_ADJUSTMENT") {
                    reasonBadge = "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400";
                  } else if (log.reason === "RETURN") {
                    reasonBadge = "bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400";
                  }

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="px-6 py-4 font-medium text-slate-450 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {formattedDate}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <Pill className="h-4 w-4 text-emerald-500 shrink-0" />
                          {log.medicine?.name || "Medicine"}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-655 dark:text-slate-300">
                        {log.batch?.batch_number || "Batch"}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-400">{log.old_quantity}</td>
                      <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-250">{log.new_quantity}</td>
                      <td className="px-6 py-4">
                        {isPositive ? (
                          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                            <ArrowUpRight className="h-3 w-3" />
                            +{log.difference}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 rounded bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
                            <ArrowDownRight className="h-3 w-3" />
                            {log.difference}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${reasonBadge}`}>
                          {log.reason.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">
                        <div className="flex items-center gap-1">
                          <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                          {log.user?.full_name || "System Process"}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No historical stock movement logs recorded.
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
