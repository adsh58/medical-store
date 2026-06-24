"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Plus, FolderPlus, ShieldAlert } from "lucide-react";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import { MedicineCategory, MedicineCreate, Company } from "@/types";

export default function AddMedicinePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

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

  const [categoryName, setCategoryName] = useState<string>("");
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);

  const [companyNameInput, setCompanyNameInput] = useState<string>("");
  const [companyTypeInput, setCompanyTypeInput] = useState<string>("Standard");
  const [companyDescInput, setCompanyDescInput] = useState<string>("");
  const [showCompanyModal, setShowCompanyModal] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);

  // Queries
  const { data: categories } = useQuery<MedicineCategory[]>({
    queryKey: ["categories"],
    queryFn: () => apiClient.get("/medicines/categories").then(res => res.data).catch(() => [
      // Fallback categories if none seeded
      { id: "1", name: "Tablet", created_at: "" },
      { id: "2", name: "Syrup", created_at: "" },
      { id: "3", name: "Capsule", created_at: "" },
    ])
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: () => apiClient.get("/medicines/companies").then(res => res.data).catch(() => [])
  });

  // Mutations
  const addMedicineMutation = useMutation({
    mutationFn: (data: MedicineCreate) => apiClient.post("/medicines", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
      router.push("/medicines");
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || "Failed to catalog medicine.");
    }
  });

  const addCategoryMutation = useMutation({
    mutationFn: (name: string) => apiClient.post("/medicines/categories", { name }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCategoryId(res.data.id);
      setShowCategoryModal(false);
      setCategoryName("");
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to create category");
    }
  });

  const addCompanyMutation = useMutation({
    mutationFn: (data: { name: string; type: string; description?: string }) =>
      apiClient.post("/medicines/companies", data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setCompany(res.data.name);
      setShowCompanyModal(false);
      setCompanyNameInput("");
      setCompanyTypeInput("Standard");
      setCompanyDescInput("");
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to create company");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !genericName || !company || !packSize || !mrp || !purchaseRate || !doctorRate || !customerRate || !categoryId) {
      setError("Please fill in all required fields.");
      return;
    }
    setError(null);

    addMedicineMutation.mutate({
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Catalog Medicine</h1>
          <p className="text-sm text-slate-500">Add a new pharmaceutical product card to the system database.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-950/35 border border-rose-900/50 p-3 text-xs text-rose-400">
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

            {/* Category selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Category *
              </label>
              <div className="flex gap-2">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  required
                >
                  <option value="" className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">Select Category</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">{cat.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(true)}
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-850"
                  title="Add Category"
                >
                  <FolderPlus className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Company selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Manufacturer Company *
              </label>
              <div className="flex gap-2">
                <select
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  required
                >
                  <option value="" className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">Select Company</option>
                  {companies?.map((comp) => (
                    <option key={comp.id} value={comp.name} className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                      {comp.name} ({comp.type})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(true)}
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-850"
                  title="Add Company"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Pack Size */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Pack Size Details *
              </label>
              <input
                type="text"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
                placeholder="e.g. 10 Tabs, 100ml Bottle"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                required
              />
            </div>

            {/* MRP */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Maximum Retail Price (MRP) *
              </label>
              <input
                type="number"
                step="0.01"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                required
              />
            </div>

            {/* Purchase Rate */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Purchase Rate *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={purchaseRate}
                  onChange={(e) => setPurchaseRate(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                  required
                />
                <button
                  type="button"
                  onClick={handleAutoSuggestRates}
                  className="rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  title="Auto suggest selling margins"
                >
                  Suggest Rates
                </button>
              </div>
            </div>

            {/* Doctor Selling Rate */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Doctor Selling Rate *
              </label>
              <input
                type="number"
                step="0.01"
                value={doctorRate}
                onChange={(e) => setDoctorRate(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                required
              />
            </div>

            {/* Customer Selling Rate */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Retail Customer Selling Rate *
              </label>
              <input
                type="number"
                step="0.01"
                value={customerRate}
                onChange={(e) => setCustomerRate(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                required
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
            <Link
              href="/medicines"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-850"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={addMedicineMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {addMedicineMutation.isPending ? "Saving..." : "Catalog Medicine"}
            </button>
          </div>
        </form>
      </div>

      {/* Category Creation Modal Dialog */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="mx-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xl">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4">Add Medicine Category</h3>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g. Injections, Syrup"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-slate-100 mb-4"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-650 hover:bg-slate-50 dark:border-slate-850 dark:bg-slate-850 text-slate-900 dark:text-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!categoryName) {
                    alert("Category name is required");
                    return;
                  }
                  addCategoryMutation.mutate(categoryName);
                }}
                disabled={addCategoryMutation.isPending}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {addCategoryMutation.isPending ? "Creating..." : "Create Category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Company Creation Modal Dialog */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="mx-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xl">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4">Add Company</h3>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyNameInput}
                  onChange={(e) => setCompanyNameInput(e.target.value)}
                  placeholder="e.g. Cipla, Micro Labs"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Company Type *
                </label>
                <select
                  value={companyTypeInput}
                  onChange={(e) => setCompanyTypeInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="Standard" className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">Standard</option>
                  <option value="Generic" className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">Generic</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  value={companyDescInput}
                  onChange={(e) => setCompanyDescInput(e.target.value)}
                  placeholder="Company description..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-650 hover:bg-slate-50 dark:border-slate-850 dark:bg-slate-850 text-slate-900 dark:text-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!companyNameInput) {
                    alert("Company Name is required");
                    return;
                  }
                  addCompanyMutation.mutate({
                    name: companyNameInput,
                    type: companyTypeInput,
                    description: companyDescInput || undefined
                  });
                }}
                disabled={addCompanyMutation.isPending}
                className="rounded-lg bg-emerald-650 px-3 py-1.5 text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {addCompanyMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
