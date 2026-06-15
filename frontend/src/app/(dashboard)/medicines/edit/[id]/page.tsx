"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, ShieldAlert } from "lucide-react";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import { MedicineCategory, Medicine } from "@/types";

export default function EditMedicinePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = React.use(params);

  // Form states
  const [name, setName] = useState<string>("");
  const [genericName, setGenericName] = useState<string>("");
  const [company, setCompany] = useState<string>("");
  const [packSize, setPackSize] = useState<string>("");
  const [mrp, setMrp] = useState<string>("");
  const [purchaseRate, setPurchaseRate] = useState<string>("");
  const [doctorRate, setDoctorRate] = useState<string>("");
  const [customerRate, setCustomerRate] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Queries
  const { data: categories } = useQuery<MedicineCategory[]>({
    queryKey: ["categories"],
    queryFn: () => apiClient.get("/medicines/categories").then(res => res.data)
  });

  const { data: medicine, isLoading: loadingMed } = useQuery<Medicine>({
    queryKey: ["medicine-detail", id],
    queryFn: () => apiClient.get(`/medicines/${id}`).then(res => res.data)
  });

  // Populate form once medicine is loaded
  useEffect(() => {
    if (medicine) {
      setName(medicine.name);
      setGenericName(medicine.generic_name);
      setCompany(medicine.company);
      setPackSize(medicine.pack_size);
      setMrp(medicine.mrp.toString());
      setPurchaseRate(medicine.current_purchase_rate.toString());
      setDoctorRate(medicine.doctor_selling_rate.toString());
      setCustomerRate(medicine.customer_selling_rate.toString());
      setCategoryId(medicine.category_id);
    }
  }, [medicine]);

  // Mutations
  const updateMedicineMutation = useMutation({
    mutationFn: (data: any) => apiClient.put(`/medicines/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
      queryClient.invalidateQueries({ queryKey: ["medicine-detail", id] });
      router.push("/medicines");
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || "Failed to update medicine details.");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !genericName || !company || !packSize || !mrp || !purchaseRate || !doctorRate || !customerRate || !categoryId) {
      setError("Please fill in all required fields.");
      return;
    }
    setError(null);

    updateMedicineMutation.mutate({
      category_id: categoryId,
      name,
      generic_name: genericName,
      company,
      pack_size: packSize,
      mrp: parseFloat(mrp),
      current_purchase_rate: parseFloat(purchaseRate),
      doctor_selling_rate: parseFloat(doctorRate),
      customer_selling_rate: parseFloat(customerRate)
    });
  };

  const handleAutoSuggestRates = () => {
    if (!purchaseRate) return;
    const rate = parseFloat(purchaseRate);
    const calculatedMRP = mrp ? parseFloat(mrp) : rate * 1.5;
    
    // Suggest rates based on margins: doctor (15%), customer (30%), capped at MRP
    setDoctorRate(Math.min(rate * 1.15, calculatedMRP).toFixed(2));
    setCustomerRate(Math.min(rate * 1.30, calculatedMRP).toFixed(2));
    if (!mrp) setMrp((rate * 1.5).toFixed(2));
  };

  if (loadingMed) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/medicines"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Edit Medicine</h1>
          <p className="text-sm text-slate-500">Update medicine credentials and catalog settings.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-950/35 border border-rose-900/50 p-3 text-xs text-rose-400 max-w-3xl">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Form panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Medicine Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Paracetamol 650mg"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                required
              />
            </div>

            {/* Generic Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Generic Name (salt) *
              </label>
              <input
                type="text"
                value={genericName}
                onChange={(e) => setGenericName(e.target.value)}
                placeholder="e.g. Acetaminophen"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-955"
                required
              >
                <option value="">Select Category</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Company */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Manufacturer Company *
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. GSK, Pfizer"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-955"
                required
              />
            </div>

            {/* Pack Size */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Pack Size *
              </label>
              <input
                type="text"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
                placeholder="e.g. 10 tablets, 100ml bottle"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-955"
                required
              />
            </div>

            {/* Purchase Rate */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Purchase Rate per Unit *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={purchaseRate}
                  onChange={(e) => setPurchaseRate(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-955"
                  required
                />
                <button
                  type="button"
                  onClick={handleAutoSuggestRates}
                  className="rounded-lg border border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-white px-3 text-xs font-semibold transition-all dark:border-emerald-600 dark:text-emerald-400"
                >
                  Suggest
                </button>
              </div>
            </div>

            {/* MRP */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Maximum Retail Price (MRP) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-955"
                required
              />
            </div>

            {/* Doctor Selling Rate */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Doctor Selling Rate *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={doctorRate}
                onChange={(e) => setDoctorRate(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-955"
                required
              />
            </div>

            {/* Customer Selling Rate */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Customer Selling Rate *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={customerRate}
                onChange={(e) => setCustomerRate(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-955"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Link
              href="/medicines"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-650 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-850"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={updateMedicineMutation.isPending}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <Save className="h-4 w-4" />
              {updateMedicineMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
