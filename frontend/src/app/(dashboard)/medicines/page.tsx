"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Search, Plus, Pill, RefreshCw, Eye, ChevronDown, ChevronUp, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import apiClient from "@/lib/api-client";
import { Medicine } from "@/types";
import { useCurrency } from "@/hooks/useCurrency";

export default function MedicinesPage() {
  const [search, setSearch] = useState<string>("");
  const [expandedMeds, setExpandedMeds] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  const deleteMedicineMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/medicines/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to delete medicine.");
    }
  });

  const handleDeleteMedicine = (id: string) => {
    if (confirm("Are you sure you want to delete this medicine from the catalog?")) {
      deleteMedicineMutation.mutate(id);
    }
  };

  // Centralized currency formatting
  const { formatCurrency, currencySymbol: currency } = useCurrency();

  const toggleExpand = (id: string) => {
    setExpandedMeds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // State for sorting & filtering
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Fetch full medicines catalog
  const { data: medicines, isLoading, refetch } = useQuery<Medicine[]>({
    queryKey: ["medicines"],
    queryFn: () => apiClient.get("/medicines?limit=1000").then(res => res.data)
  });

  // Fetch categories to map category_id -> name
  const { data: categories } = useQuery<any[]>({
    queryKey: ["categories"],
    queryFn: () => apiClient.get("/medicines/categories").then(res => res.data)
  });

  // Category ID -> Category Name lookup map
  const categoryMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    categories?.forEach(cat => {
      map[cat.id] = cat.name;
    });
    return map;
  }, [categories]);

  // Unique list of companies for dropdown filter
  const companies = React.useMemo(() => {
    if (!medicines) return [];
    const set = new Set<string>();
    medicines.forEach(m => {
      if (m.company) set.add(m.company);
    });
    return Array.from(set).sort();
  }, [medicines]);

  // Client-side filtering logic
  const filteredMedicines = React.useMemo(() => {
    if (!medicines) return [];
    return medicines.filter(med => {
      if (search) {
        const query = search.toLowerCase();
        const matchesName = med.name?.toLowerCase().includes(query);
        const matchesGeneric = med.generic_name?.toLowerCase().includes(query);
        const matchesCompany = med.company?.toLowerCase().includes(query);
        if (!matchesName && !matchesGeneric && !matchesCompany) return false;
      }
      if (selectedCategory) {
        if (med.category_id !== selectedCategory) return false;
      }
      if (selectedCompany) {
        if (med.company !== selectedCompany) return false;
      }
      return true;
    });
  }, [medicines, search, selectedCategory, selectedCompany]);

  // Client-side sorting logic
  const sortedMedicines = React.useMemo(() => {
    const list = [...filteredMedicines];
    if (!sortColumn) return list;

    list.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortColumn === "name") {
        valA = a.name || "";
        valB = b.name || "";
      } else if (sortColumn === "company") {
        valA = a.company || "";
        valB = b.company || "";
      } else if (sortColumn === "category") {
        valA = categoryMap[a.category_id] || "Uncategorized";
        valB = categoryMap[b.category_id] || "Uncategorized";
      } else if (sortColumn === "mrp") {
        valA = a.mrp || 0;
        valB = b.mrp || 0;
      } else if (sortColumn === "purchase") {
        valA = a.current_purchase_rate || 0;
        valB = b.current_purchase_rate || 0;
      } else if (sortColumn === "doctor") {
        valA = a.doctor_selling_rate || 0;
        valB = b.doctor_selling_rate || 0;
      } else if (sortColumn === "customer") {
        valA = a.customer_selling_rate || 0;
        valB = b.customer_selling_rate || 0;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortDirection === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return sortDirection === "asc"
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      }
    });
    return list;
  }, [filteredMedicines, sortColumn, sortDirection, categoryMap]);

  // Reset page when search term or filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, selectedCompany]);

  const totalItems = sortedMedicines.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentMedicines = sortedMedicines.slice(startIndex, endIndex);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const renderSortHeader = (label: string, column: string, style?: React.CSSProperties) => {
    const isActive = sortColumn === column;
    return (
      <th 
        className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors select-none"
        onClick={() => handleSort(column)}
        style={style}
      >
        <div className="flex items-center gap-1.5">
          <span>{label}</span>
          <span className="text-slate-400">
            {isActive ? (
              sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5 text-emerald-500" /> : <ChevronDown className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 opacity-20" />
            )}
          </span>
        </div>
      </th>
    );
  };

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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-xs">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, generic, or company..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-4 pl-10 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 min-w-[160px]"
          >
            <option value="">All Categories</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 min-w-[160px]"
          >
            <option value="">All Companies</option>
            {companies.map((comp) => (
              <option key={comp} value={comp}>{comp}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            setSearch("");
            setSelectedCategory("");
            setSelectedCompany("");
            refetch();
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reset & Reload
        </button>
      </div>

      {/* Catalog Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900/60">
                {renderSortHeader("Medicine Info", "name", { minWidth: "240px" })}
                {renderSortHeader("Company", "company", { minWidth: "130px" })}
                {renderSortHeader("Category", "category", { minWidth: "140px" })}
                <th className="px-6 py-4" style={{ minWidth: "100px" }}>Pack Size</th>
                {renderSortHeader("MRP", "mrp", { minWidth: "90px" })}
                {renderSortHeader("Purchase Rate", "purchase", { minWidth: "135px" })}
                {renderSortHeader("Doctor Rate", "doctor", { minWidth: "125px" })}
                {renderSortHeader("Retail Customer", "customer", { minWidth: "145px" })}
                <th className="px-6 py-4 text-right" style={{ minWidth: "180px" }}>Actions</th>
              </tr>
            </thead>
             <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  </td>
                </tr>
              ) : filteredMedicines && filteredMedicines.length > 0 ? (
                <>
                  {currentMedicines.map((med) => {
                    const isExpanded = !!expandedMeds[med.id];
                    const totalStock = med.batches?.reduce((sum, b) => sum + b.current_stock, 0) ?? 0;
                    
                    return (
                      <React.Fragment key={med.id}>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 border-b border-slate-100 dark:border-slate-850">
                          <td className="px-6 py-4">
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => toggleExpand(med.id)}
                                className="mt-1 text-slate-400 hover:text-slate-200 shrink-0"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 shrink-0">
                                <Pill className="h-4 w-4" />
                              </div>
                              <div className="break-words whitespace-normal max-w-[240px]">
                                <p className="font-semibold text-slate-900 dark:text-slate-100 break-words whitespace-normal">{med.name}</p>
                                <p className="text-xs text-slate-400 break-words whitespace-normal">{med.generic_name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-350 break-words whitespace-normal max-w-[130px]">{med.company}</td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-350 break-words whitespace-normal max-w-[140px]">{categoryMap[med.category_id] || "Uncategorized"}</td>
                          <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-300">{med.pack_size}</td>
                          <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-200">{currency}{med.mrp.toFixed(2)}</td>
                          <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-450">{currency}{med.current_purchase_rate.toFixed(2)}</td>
                          <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">{currency}{med.doctor_selling_rate.toFixed(2)}</td>
                          <td className="px-6 py-4 font-semibold text-emerald-600 dark:text-emerald-400">{currency}{med.customer_selling_rate.toFixed(2)}</td>
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
                                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                title="View Details"
                              >
                                <Eye className="h-3 w-3" />
                                Details
                              </Link>
                              <Link
                                href={`/medicines/edit/${med.id}`}
                                className="inline-flex items-center gap-1 rounded bg-slate-100 p-1.5 text-xs font-semibold text-blue-650 hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-400 dark:hover:bg-blue-950/30"
                                title="Edit Medicine"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Link>
                              <button
                                onClick={() => handleDeleteMedicine(med.id)}
                                className="inline-flex items-center gap-1 rounded bg-slate-100 p-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:bg-slate-800 dark:text-rose-450 dark:hover:bg-rose-950/30"
                                title="Delete Medicine"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        
                        {isExpanded && (
                          <tr className="bg-slate-50/20 dark:bg-slate-900/10">
                            <td colSpan={9} className="px-6 py-4">
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
                  })}
                </>
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    No medicines cataloged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalItems > itemsPerPage && (
          <div className="flex items-center justify-between border-t border-slate-150 bg-white px-6 py-4 dark:border-slate-800/60 dark:bg-slate-900">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-slate-500">
                  Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{totalItems === 0 ? 0 : startIndex + 1}</span> to{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{endIndex}</span> of{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{totalItems}</span> entries
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 dark:ring-slate-800 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          aria-current={currentPage === page ? "page" : undefined}
                          className={`relative inline-flex items-center px-3 py-1.5 text-xs font-semibold focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                            currentPage === page
                              ? "z-10 bg-emerald-600 text-white focus-visible:outline-emerald-600"
                              : "text-slate-900 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus:outline-offset-0 dark:text-slate-300 dark:ring-slate-800 dark:hover:bg-slate-800"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    }
                    if (page === 2 || page === totalPages - 1) {
                      return (
                        <span
                          key={page}
                          className="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-400 ring-1 ring-inset ring-slate-200 dark:ring-slate-800"
                        >
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 dark:ring-slate-800 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
