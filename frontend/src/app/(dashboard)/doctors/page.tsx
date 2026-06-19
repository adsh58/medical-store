"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, Edit, Save, X, UserCheck, ShieldAlert, CheckCircle2, ChevronLeft, ChevronRight, Phone, MapPin, Building, ToggleLeft, ToggleRight } from "lucide-react";
import apiClient from "@/lib/api-client";

interface Doctor {
  id: string;
  store_id: string;
  name: string;
  mobile: string;
  clinic_name?: string;
  address?: string;
  active: boolean;
  created_at: string;
}

export default function DoctorsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  
  // Create Form state
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [address, setAddress] = useState("");
  
  // Edit Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editClinicName, setEditClinicName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editActive, setEditActive] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Reset page when search term changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // Queries
  const { data: doctors, isLoading } = useQuery<Doctor[]>({
    queryKey: ["doctors", search],
    queryFn: () => {
      const url = search ? `/doctors?search=${encodeURIComponent(search)}` : "/doctors";
      return apiClient.get(url).then(res => res.data);
    }
  });

  const totalItems = doctors ? doctors.length : 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentDoctors = doctors ? doctors.slice(startIndex, endIndex) : [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newDoc: Partial<Doctor>) => apiClient.post("/doctors", newDoc).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      setName("");
      setMobile("");
      setClinicName("");
      setAddress("");
      setSuccess("Doctor profile added successfully!");
      setTimeout(() => setSuccess(null), 3000);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.response?.data?.detail || "Failed to add doctor");
    }
  });

  const updateMutation = useMutation({
    mutationFn: (updated: Partial<Doctor>) => 
      apiClient.put(`/doctors/${updated.id}`, updated).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      setEditingId(null);
      setSuccess("Doctor details updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.response?.data?.detail || "Failed to update doctor details");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/doctors/${id}`).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      setSuccess("Doctor deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.response?.data?.detail || "Failed to delete doctor record");
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !mobile) return;
    createMutation.mutate({
      name,
      mobile,
      clinic_name: clinicName || undefined,
      address: address || undefined
    });
  };

  const handleStartEdit = (doc: Doctor) => {
    setEditingId(doc.id);
    setEditName(doc.name);
    setEditMobile(doc.mobile);
    setEditClinicName(doc.clinic_name || "");
    setEditAddress(doc.address || "");
    setEditActive(doc.active);
  };

  const handleSaveEdit = (id: string) => {
    if (!editName || !editMobile) return;
    updateMutation.mutate({ 
      id, 
      name: editName, 
      mobile: editMobile, 
      clinic_name: editClinicName || undefined, 
      address: editAddress || undefined,
      active: editActive
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this doctor?")) {
      deleteMutation.mutate(id);
    }
  };

  const toggleDoctorActive = (doc: Doctor) => {
    updateMutation.mutate({
      id: doc.id,
      active: !doc.active
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/10 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-emerald-500" />
            Doctor Registry
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage doctor profiles referred for retail checkouts and sales margin settings.</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/35 border border-emerald-900/50 p-3 text-xs text-emerald-450 max-w-2xl animate-in fade-in duration-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-950/35 border border-rose-900/50 p-3 text-xs text-rose-450 max-w-2xl animate-in fade-in duration-300">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Side: Create Form */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4">Add Doctor Profile</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-450 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. John Doe"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-850 dark:bg-slate-950 dark:text-slate-200"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-450 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Mobile Number *
              </label>
              <input
                type="text"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="9876543210"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-850 dark:bg-slate-950 dark:text-slate-200"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-450 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Clinic Name
              </label>
              <input
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="City Health Care"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-850 dark:bg-slate-950 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-450 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Address / Location
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Clinic Address..."
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-850 dark:bg-slate-950 dark:text-slate-200"
              />
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              {createMutation.isPending ? "Adding..." : "Add Doctor"}
            </button>
          </form>
        </div>

        {/* Right Side: List & Search */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search doctor by name, clinic, or mobile..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-4 pl-10 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-400 font-semibold dark:border-slate-800 dark:bg-slate-900/60">
                    <th className="px-6 py-3">Full Name</th>
                    <th className="px-6 py-3">Mobile</th>
                    <th className="px-6 py-3">Clinic Name</th>
                    <th className="px-6 py-3">Address</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center">
                        <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                      </td>
                    </tr>
                  ) : doctors && doctors.length > 0 ? (
                    currentDoctors.map((doc) => {
                      const isEditing = editingId === doc.id;
                      return (
                        <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                          {/* Name */}
                          <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="rounded border border-slate-250 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 w-full"
                              />
                            ) : (
                              doc.name
                            )}
                          </td>
                          {/* Mobile */}
                          <td className="px-6 py-4 text-slate-650 dark:text-slate-400 font-medium">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editMobile}
                                onChange={(e) => setEditMobile(e.target.value)}
                                className="rounded border border-slate-250 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 w-full"
                              />
                            ) : (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-slate-400" />
                                {doc.mobile}
                              </span>
                            )}
                          </td>
                          {/* Clinic Name */}
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editClinicName}
                                onChange={(e) => setEditClinicName(e.target.value)}
                                className="rounded border border-slate-250 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 w-full"
                              />
                            ) : (
                              doc.clinic_name ? (
                                <span className="flex items-center gap-1">
                                  <Building className="h-3 w-3 text-slate-400" />
                                  {doc.clinic_name}
                                </span>
                              ) : (
                                <span className="text-slate-350 italic">-</span>
                              )
                            )}
                          </td>
                          {/* Address */}
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editAddress}
                                onChange={(e) => setEditAddress(e.target.value)}
                                className="rounded border border-slate-250 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 w-full"
                              />
                            ) : (
                              doc.address ? (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                  {doc.address}
                                </span>
                              ) : (
                                <span className="text-slate-350 italic">-</span>
                              )
                            )}
                          </td>
                          {/* Status */}
                          <td className="px-6 py-4 text-center">
                            {isEditing ? (
                              <button
                                type="button"
                                onClick={() => setEditActive(!editActive)}
                                className="inline-flex cursor-pointer focus:outline-none"
                              >
                                {editActive ? (
                                  <ToggleRight className="h-6 w-6 text-emerald-500" />
                                ) : (
                                  <ToggleLeft className="h-6 w-6 text-slate-400" />
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleDoctorActive(doc)}
                                className="inline-flex cursor-pointer focus:outline-none"
                              >
                                {doc.active ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-450 border border-emerald-900/50">
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-slate-800/40 px-2 py-0.5 text-[10px] font-semibold text-slate-450 border border-slate-700/50">
                                    Inactive
                                  </span>
                                )}
                              </button>
                            )}
                          </td>
                          {/* Actions */}
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleSaveEdit(doc.id)}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded cursor-pointer"
                                    title="Save"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleStartEdit(doc)}
                                    className="p-1.5 text-slate-455 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                                    title="Edit"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(doc.id)}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded cursor-pointer"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-450">
                        No doctors registered yet in this store registry.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalItems > itemsPerPage && (
              <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4 dark:border-slate-800/60 dark:bg-slate-900">
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
                      Showing <span className="font-semibold text-slate-705 dark:text-slate-300">{totalItems === 0 ? 0 : startIndex + 1}</span> to{" "}
                      <span className="font-semibold text-slate-705 dark:text-slate-300">{endIndex}</span> of{" "}
                      <span className="font-semibold text-slate-705 dark:text-slate-300">{totalItems}</span> entries
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 dark:ring-slate-800 dark:hover:bg-slate-800 disabled:opacity-40"
                      >
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
                              className={`relative inline-flex items-center px-3 py-1.5 text-xs font-semibold focus:z-20 ${
                                currentPage === page
                                  ? "z-10 bg-emerald-600 text-white"
                                  : "text-slate-900 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-800 dark:hover:bg-slate-800"
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
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
