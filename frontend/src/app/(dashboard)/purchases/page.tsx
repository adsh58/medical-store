"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { FileSpreadsheet, Plus, UploadCloud, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import apiClient from "@/lib/api-client";
import { PurchaseInvoice } from "@/types";

export default function PurchaseInvoicesPage() {
  const { data: invoices, isLoading, refetch } = useQuery<PurchaseInvoice[]>({
    queryKey: ["invoices"],
    queryFn: () => apiClient.get("/purchases/invoices").then(res => res.data)
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Purchase Invoices</h1>
          <p className="text-sm text-slate-500">Record supplier shipments, audit invoice histories, and track scanner imports.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/purchases/upload"
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-500"
          >
            <UploadCloud className="h-4 w-4" />
            AI Scan Invoice
          </Link>
        </div>
      </div>

      {/* Control bar */}
      <div className="flex justify-end">
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reload List
        </button>
      </div>

      {/* Invoices list table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-6 py-4">Invoice Number</th>
                <th className="px-6 py-4">Supplier Agency</th>
                <th className="px-6 py-4">Billing Date</th>
                <th className="px-6 py-4">Total Amount</th>
                <th className="px-6 py-4">AI Audit Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  </td>
                </tr>
              ) : invoices && invoices.length > 0 ? (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                        {inv.invoice_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-650 dark:text-slate-300">
                      {/* Agency relation is pre-joined */}
                      {(inv as any).agency?.name || "LifeCare Pharmaceuticals"}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(inv.invoice_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                      ${inv.total_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      {inv.ai_status === "COMPLETED" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Success
                        </span>
                      ) : inv.ai_status === "FAILED" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
                          <AlertCircle className="h-3 w-3" />
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400 animate-pulse">
                          Processing
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No purchase invoices logged yet.
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
