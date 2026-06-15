"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, ShieldCheck, Database, Save, RotateCcw } from "lucide-react";
import apiClient from "@/lib/api-client";

interface SystemSettings {
  id: string;
  store_name: string;
  currency: string;
  customer_margin: number;
  doctor_margin: number;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [storeName, setStoreName] = useState<string>("Alpha Pharmacy");
  const [currency, setCurrency] = useState<string>("$");
  const [customerMargin, setCustomerMargin] = useState<number>(30);
  const [doctorMargin, setDoctorMargin] = useState<number>(15);
  const [success, setSuccess] = useState<string | null>(null);

  // Queries
  const { data: settingsData, isLoading } = useQuery<SystemSettings>({
    queryKey: ["system-settings"],
    queryFn: () => apiClient.get("/settings").then(res => res.data)
  });

  // Load values into local state
  useEffect(() => {
    if (settingsData) {
      setStoreName(settingsData.store_name);
      setCurrency(settingsData.currency);
      setCustomerMargin(settingsData.customer_margin);
      setDoctorMargin(settingsData.doctor_margin);
    }
  }, [settingsData]);

  // Mutations
  const updateSettingsMutation = useMutation({
    mutationFn: (payload: Partial<SystemSettings>) => apiClient.put("/settings/", payload).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      setSuccess("Store configuration settings saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || err.response?.data?.detail || "Failed to update configuration settings");
    }
  });

  const seedMutation = useMutation({
    mutationFn: () => {
      return apiClient.post("/medicines", {
        category_id: "00000000-0000-0000-0000-000000000000",
        name: "Paracetamol 650mg",
        generic_name: "Acetaminophen",
        company: "GlaxoSmithKline",
        pack_size: "10 Tablets",
        mrp: 15.00,
        current_purchase_rate: 10.00,
        doctor_selling_rate: 11.50,
        customer_selling_rate: 13.00
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
      setSuccess("Database demo data seeded successfully! You can now test the AI scanning comparison tools.");
      setTimeout(() => setSuccess(null), 5000);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Seeding failed or database already populated.");
    }
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate({
      store_name: storeName,
      currency: currency,
      customer_margin: customerMargin,
      doctor_margin: doctorMargin
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">System Settings</h1>
        <p className="text-sm text-slate-500">Configure pharmacy markup margins and manage data initialization tools.</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/35 border border-emerald-900/50 p-3 text-xs text-emerald-450 max-w-2xl">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Settings form card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Settings className="h-4 w-4 text-emerald-500" />
            Markup & Regional Configuration
          </h2>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Pharmacy Outlet Name
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Currency Symbol
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                required
              >
                <option value="₹">₹ (INR)</option>
                <option value="$">$ (USD)</option>
                <option value="€">€ (EUR)</option>
                <option value="£">£ (GBP)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Default Retail Customer Margin (%)
              </label>
              <input
                type="number"
                value={customerMargin}
                onChange={(e) => setCustomerMargin(parseInt(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Default Doctor Margin (%)
              </label>
              <input
                type="number"
                value={doctorMargin}
                onChange={(e) => setDoctorMargin(parseInt(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                required
              />
            </div>

            <button
              type="submit"
              disabled={updateSettingsMutation.isPending}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <Save className="h-3.5 w-3.5" />
              {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </button>
          </form>
        </div>

        {/* Database administration tools */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Database className="h-4 w-4 text-emerald-500" />
              Developer System Seeding
            </h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              If running in a local clean environment, utilize this developer module helper to seed default catalog medicines. 
              This prepares records so you can test price differences when uploading invoices.
            </p>
          </div>

          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-250 bg-white py-2 text-xs font-semibold text-slate-650 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-850"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {seedMutation.isPending ? "Seeding..." : "Seed Demo Medicines"}
          </button>
        </div>
      </div>
    </div>
  );
}

