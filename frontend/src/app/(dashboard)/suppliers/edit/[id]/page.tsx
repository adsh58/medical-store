"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import { Truck, ArrowLeft, ShieldAlert, CheckCircle2 } from "lucide-react";
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

export default function EditSupplierPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Query
  const { data: supplier, isLoading } = useQuery<Supplier>({
    queryKey: ["supplier", id],
    queryFn: () => apiClient.get(`/agencies/${id}`).then(res => res.data),
    enabled: !!id
  });

  // Populate state when supplier loads
  useEffect(() => {
    if (supplier) {
      setName(supplier.name || "");
      setContactName(supplier.contact_name || "");
      setPhone(supplier.phone || "");
      setEmail(supplier.email || "");
      setGstNumber(supplier.gst_number || "");
      setCity(supplier.city || "");
      setState(supplier.state || "");
      setAddress(supplier.address || "");
      setIsActive(supplier.is_active);
    }
  }, [supplier]);

  // Mutation
  const updateMutation = useMutation({
    mutationFn: (updatedSupplier: any) => apiClient.put(`/agencies/${id}`, updatedSupplier).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-count"] });
      queryClient.invalidateQueries({ queryKey: ["supplier", id] });
      setSuccess("Supplier updated successfully!");
      setError(null);
      setTimeout(() => {
        router.push("/suppliers");
      }, 1500);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.response?.data?.detail || "Failed to update supplier");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    updateMutation.mutate({
      name,
      contact_name: contactName || null,
      phone: phone || null,
      email: email || null,
      gst_number: gstNumber || null,
      city: city || null,
      state: state || null,
      address: address || null,
      is_active: isActive
    });
  };

  if (isLoading) {
    return (
      <div className="text-sm text-slate-450 p-6">
        Loading supplier coordinates...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back to list */}
      <div>
        <Link
          href="/suppliers"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-450 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to suppliers list
        </Link>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <Truck className="h-6 w-6 text-emerald-500" />
          Edit Supplier Profile
        </h1>
        <p className="text-sm text-slate-500">Update supplier distribution details, credentials, and contact coordinates.</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/35 border border-emerald-900/50 p-3 text-xs text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-950/35 border border-rose-900/50 p-3 text-xs text-rose-455">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Supplier Name */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider mb-1.5">
              Supplier Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shiv Medical Agency"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-105"
              required
            />
          </div>

          {/* Contact Person */}
          <div>
            <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider mb-1.5">
              Contact Person Name
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Rajesh Kumar"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-105"
            />
          </div>

          {/* GST Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-455 uppercase tracking-wider mb-1.5 font-mono">
              GST Number
            </label>
            <input
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="e.g. 24AAAAS1234A1Z1"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-105"
            />
          </div>

          {/* Mobile Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider mb-1.5">
              Mobile / Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-105"
            />
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-455 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. contact@supplier.com"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-955 dark:text-slate-105"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider mb-1.5">
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Ahmedabad"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-105"
            />
          </div>

          {/* State */}
          <div>
            <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider mb-1.5">
              State
            </label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="e.g. Gujarat"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-955 dark:text-slate-105"
            />
          </div>

          {/* Address Details */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider mb-1.5">
              Physical Address
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full mailing details..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-105"
            />
          </div>

          {/* Active switch */}
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-955"
            />
            <label htmlFor="is-active" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              Supplier Active Status (Allow imports and purchases)
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-850 pt-4">
          <Link
            href="/suppliers"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-655 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-350 dark:hover:bg-slate-850"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
