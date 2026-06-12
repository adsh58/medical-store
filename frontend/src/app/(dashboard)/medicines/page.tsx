"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search, Plus, Pill, RefreshCw, Eye, ChevronDown, ChevronUp } from "lucide-react";
import apiClient from "@/lib/api-client";
import { Medicine } from "@/types";

export default function MedicinesPage() {
  const [search, setSearch] = useState<string>("");
  const [expandedMeds, setExpandedMeds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedMeds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const { data: medicines, isLoading, refetch } = useQuery<Medicine[]>({
    queryKey: ["medicines", search],
    queryFn: () => {
      const url = search ? `/medicines?search=${encodeURIComponent(search)}` : "/medicines";
      return apiClient.get(url).then(res => res.data);
    }
  });

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Medicines Catalog</h1>
          <p className="text-sm text-slate-500">View and manage all pharmaceutical products in the store inventory.</p>
        </div>
        <Link
          href="/medicines/add"
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          Add New Medicine
        </Link>
      </div>

      {/* Control bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, generic, or company..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-4 pl-10 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reload List
        </button>
      </div>

      {/* Catalog Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-6 py-4">Medicine Info</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Pack Size</th>
                <th className="px-6 py-4">MRP</th>
                <th className="px-6 py-4">Purchase Rate</th>
                <th className="px-6 py-4">Doctor Rate</th>
                <th className="px-6 py-4">Retail Customer</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  </td>
                </tr>
              ) : medicines && medicines.length > 0 ? (
                medicines.map((med) => {
                  const isExpanded = !!expandedMeds[med.id];
                  const totalStock = med.batches?.reduce((sum, b) => sum + b.current_stock, 0) ?? 0;
                  
                  return (
                    <React.Fragment key={med.id}>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 border-b border-slate-100 dark:border-slate-850">
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => toggleExpand(med.id)}
                              className="mt-1 text-slate-400 hover:text-slate-200"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                              <Pill className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-100">{med.name}</p>
                              <p className="text-xs text-slate-400">{med.generic_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-350">{med.company}</td>
                        <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-300">{med.pack_size}</td>
                        <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-200">${med.mrp.toFixed(2)}</td>
                        <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-450">${med.current_purchase_rate.toFixed(2)}</td>
                        <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">${med.doctor_selling_rate.toFixed(2)}</td>
                        <td className="px-6 py-4 font-semibold text-emerald-600 dark:text-emerald-400">${med.customer_selling_rate.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => toggleExpand(med.id)}
                              className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            >
                              {isExpanded ? "Hide Details" : "Show Details"}
                            </button>
                            <Link
                              href={`/medicines/${med.id}`}
                              className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              <Eye className="h-3 w-3" />
                              Details
                            </Link>
                          </div>
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="bg-slate-50/20 dark:bg-slate-900/10">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="space-y-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800/85 bg-white dark:bg-slate-950/40">
                              <div className="flex justify-between items-center">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Inventory Batches</h4>
                                <span className="text-xs text-slate-400 dark:text-slate-500">Total Available Stock: <strong className="text-emerald-500">{totalStock} units</strong></span>
                              </div>
                              {med.batches && med.batches.length > 0 ? (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                  {med.batches.map((batch) => {
                                    const expDate = new Date(batch.expiry_date);
                                    const today = new Date();
                                    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                    let expColor = "text-emerald-500 bg-emerald-950/20";
                                    let expStatus = "Normal";
                                    if (diffDays <= 0) {
                                      expColor = "text-rose-500 bg-rose-950/20";
                                      expStatus = "Expired";
                                    } else if (diffDays <= 30) {
                                      expColor = "text-rose-400 bg-rose-950/25";
                                      expStatus = "Critical <30d";
                                    } else if (diffDays <= 90) {
                                      expColor = "text-amber-500 bg-amber-950/20";
                                      expStatus = "Warning <90d";
                                    }

                                    const isLow = batch.current_stock <= batch.reorder_level;

                                    return (
                                      <div key={batch.id} className="p-3 border border-slate-100 dark:border-slate-850 rounded-lg space-y-2 bg-slate-50/30 dark:bg-slate-950/20">
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Batch: {batch.batch_number}</span>
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${expColor}`}>{expStatus}</span>
                                        </div>
                                        <div className="text-[11px] space-y-1 text-slate-500 dark:text-slate-450">
                                          <p className="flex justify-between">
                                            <span>Current Stock:</span>
                                            <span className={`font-bold ${isLow ? 'text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}>
                                              {batch.current_stock} units
                                            </span>
                                          </p>
                                          <p className="flex justify-between">
                                            <span>Safety Level:</span>
                                            <span>Min: {batch.minimum_stock} • Reorder: {batch.reorder_level}</span>
                                          </p>
                                          <p className="flex justify-between">
                                            <span>Expiry Date:</span>
                                            <span className="font-semibold">{expDate.toLocaleDateString()}</span>
                                          </p>
                                          <p className="flex justify-between border-t border-slate-100 dark:border-slate-800/80 pt-1 mt-1">
                                            <span>Rack Coordinate:</span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-450">{batch.location_coordinate}</span>
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 py-2">No physical inventory batches currently recorded in stock.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No medicines cataloged yet.
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
