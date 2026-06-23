"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, Edit, CheckCircle2, ShieldAlert, ChevronLeft, ChevronRight, Truck, MapPin } from "lucide-react";
import Link from "next/link";
import apiClient from "@/lib/api-client";

interface Supplier {
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
}

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset page on search change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // Queries
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["suppliers-count", search],
    queryFn: () => apiClient.get(`/agencies/count?search=${encodeURIComponent(search)}`).then(res => res.data)
  });

  const { data: suppliers, isLoading } = useQuery<Supplier[]>({
    queryKey: ["suppliers", search, currentPage],
    queryFn: () => {
      const skip = (currentPage - 1) * itemsPerPage;
      const url = `/agencies/?skip=${skip}&limit=${itemsPerPage}&search=${encodeURIComponent(search)}`;
      return apiClient.get(url).then(res => res.data);
    }
  });

  const totalItems = countData?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/agencies/${id}`).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-count"] });
      setSuccess("Supplier profile deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || "Failed to delete supplier");
      setTimeout(() => setError(null), 4000);
    }
  });

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete supplier "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Truck className="h-6 w-6 text-emerald-500" />
            Supplier Registry
          </h1>
          <p className="text-sm text-slate-500">Manage registered supplying agencies, distributors, and credentials.</p>
        </div>
        <div>
          <Link
            href="/suppliers/add"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Supplier
          </Link>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/35 border border-emerald-900/50 p-3 text-xs text-emerald-400 max-w-2xl">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-950/35 border border-rose-900/50 p-3 text-xs text-rose-450 max-w-2xl">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Control bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, GST, or city..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-4 pl-10 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="text-xs text-slate-400 font-medium">
          Total suppliers: {totalItems}
        </div>
      </div>

      {/* Table grid */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-450 font-bold uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-6 py-3">Supplier Name</th>
                <th className="px-6 py-3">GST Number</th>
                <th className="px-6 py-3">Location (City, State)</th>
                <th className="px-6 py-3">Contact details</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-450">
                    Loading suppliers...
                  </td>
                </tr>
              ) : suppliers && suppliers.length > 0 ? (
                suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{supplier.name}</p>
                      <p className="text-[10px] text-slate-450">{supplier.contact_name || "No contact person"}</p>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-slate-650 dark:text-slate-350">
                      {supplier.gst_number || "—"}
                    </td>
                    <td className="px-6 py-4 space-y-0.5">
                      <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{supplier.city || "—"}{supplier.state ? `, ${supplier.state}` : ""}</span>
                      </div>
                      <p className="text-[10px] text-slate-450 truncate max-w-xs">{supplier.address || ""}</p>
                    </td>
                    <td className="px-6 py-4 space-y-0.5 text-slate-650 dark:text-slate-350">
                      <p>{supplier.phone || "—"}</p>
                      <p className="text-[10px] text-slate-400">{supplier.email || ""}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          supplier.is_active
                            ? "bg-emerald-950/20 text-emerald-450"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {supplier.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/suppliers/edit/${supplier.id}`}
                          className="rounded p-1 text-slate-450 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          title="Edit Supplier"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(supplier.id, supplier.name)}
                          className="rounded p-1 text-slate-450 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
                          title="Delete Supplier"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-450">
                    No suppliers registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="text-xs text-slate-450">
              Showing Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalItems} total items)
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded border border-slate-200 bg-white p-1 text-slate-655 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-350 dark:hover:bg-slate-850"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="rounded border border-slate-200 bg-white p-1 text-slate-655 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-350 dark:hover:bg-slate-850"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
