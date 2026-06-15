"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, Edit, Save, X, ShieldAlert, CheckCircle2, Users } from "lucide-react";
import apiClient from "@/lib/api-client";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // Create form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  // Edit form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Queries
  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["customers", search],
    queryFn: () => {
      const url = search ? `/customers?search=${encodeURIComponent(search)}` : "/customers";
      return apiClient.get(url).then(res => res.data);
    }
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newCust: any) => apiClient.post("/customers/", newCust).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setSuccess("Customer registered successfully!");
      setTimeout(() => setSuccess(null), 3000);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.response?.data?.detail || "Failed to register customer");
    }
  });

  const updateMutation = useMutation({
    mutationFn: (updated: any) => 
      apiClient.put(`/customers/${updated.id}`, { name: updated.name, phone: updated.phone, email: updated.email || null, address: updated.address || null }).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setEditingId(null);
      setSuccess("Customer updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.response?.data?.detail || "Failed to update customer");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/customers/${id}`).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setSuccess("Customer profile deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.response?.data?.detail || "Failed to delete customer");
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    createMutation.mutate({ name, phone, email: email || null, address: address || null });
  };

  const handleStartEdit = (cust: Customer) => {
    setEditingId(cust.id);
    setEditName(cust.name);
    setEditPhone(cust.phone);
    setEditEmail(cust.email || "");
    setEditAddress(cust.address || "");
  };

  const handleSaveEdit = (id: string) => {
    if (!editName || !editPhone) return;
    updateMutation.mutate({ id, name: editName, phone: editPhone, email: editEmail, address: editAddress });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this customer?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <Users className="h-6 w-6 text-emerald-500" />
          Customer Database
        </h1>
        <p className="text-sm text-slate-500">Add, edit, delete, and search system customers.</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/35 border border-emerald-900/50 p-3 text-xs text-emerald-450 max-w-2xl">
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

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Side: Create Form */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4">Register Customer</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider mb-1.5">
                Customer Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alice Smith"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider mb-1.5">
                Mobile Number *
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alice@example.com"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-455 uppercase tracking-wider mb-1.5">
                Home Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street details..."
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {createMutation.isPending ? "Registering..." : "Register Customer"}
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
              placeholder="Search customer by name or phone..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-4 pl-10 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-400 font-semibold dark:border-slate-800 dark:bg-slate-900/60">
                    <th className="px-6 py-3">Customer Name</th>
                    <th className="px-6 py-3">Mobile Number</th>
                    <th className="px-6 py-3">Email Address</th>
                    <th className="px-6 py-3">Address</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center">
                        <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                      </td>
                    </tr>
                  ) : customers && customers.length > 0 ? (
                    customers.map((cust) => {
                      const isEditing = editingId === cust.id;
                      return (
                        <tr key={cust.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                          <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="rounded border border-slate-250 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 w-full"
                              />
                            ) : (
                              cust.name
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-700 font-bold dark:text-slate-300">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editPhone}
                                onChange={(e) => setEditPhone(e.target.value)}
                                className="rounded border border-slate-250 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 w-full"
                              />
                            ) : (
                              cust.phone
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-medium">
                            {isEditing ? (
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="rounded border border-slate-250 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 w-full"
                              />
                            ) : (
                              cust.email || <span className="text-slate-350 italic">None</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editAddress}
                                onChange={(e) => setEditAddress(e.target.value)}
                                className="rounded border border-slate-250 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 w-full"
                              />
                            ) : (
                              cust.address || <span className="text-slate-350 italic">None</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleSaveEdit(cust.id)}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded"
                                    title="Save"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                                    title="Cancel"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleStartEdit(cust)}
                                    className="p-1.5 text-slate-455 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                                    title="Edit"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(cust.id)}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded"
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
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                        No customers registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
