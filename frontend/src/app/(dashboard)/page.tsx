"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { 
  Pill, Package, AlertTriangle, ArrowUpRight, 
  TrendingUp, CircleAlert, Sparkles, FileSpreadsheet
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { Medicine, Stock, ExpiryAlert, Sale } from "@/types";

export default function DashboardPage() {
  // Queries
  const { data: medicines } = useQuery<Medicine[]>({
    queryKey: ["medicines"],
    queryFn: () => apiClient.get("/medicines").then(res => res.data)
  });

  const { data: lowStock } = useQuery<Stock[]>({
    queryKey: ["lowStock"],
    queryFn: () => apiClient.get("/inventory/stock/low").then(res => res.data)
  });

  const { data: expiryAlerts } = useQuery<ExpiryAlert[]>({
    queryKey: ["expiryAlerts"],
    queryFn: () => apiClient.get("/alerts/expiry").then(res => res.data)
  });

  const { data: sales } = useQuery<Sale[]>({
    queryKey: ["recentSales"],
    queryFn: () => apiClient.get("/sales?limit=5").then(res => res.data)
  });

  // Calculations
  const medicinesCount = medicines?.length || 0;
  const lowStockCount = lowStock?.length || 0;
  const expiryCount = expiryAlerts?.length || 0;
  const recentSales = sales || [];

  return (
    <div className="space-y-6">
      {/* Top Welcome Title */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Dashboard Overview</h1>
          <p className="text-sm text-slate-500">Real-time statistics of your pharmacy store catalog and stocks.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/purchases/upload"
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-500"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Upload Invoice
          </Link>
          <Link
            href="/purchases"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            View Invoices
          </Link>
        </div>
      </div>

      {/* Grid Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active medicines */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Medicines Catalog</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Pill className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{medicinesCount}</h3>
            <p className="text-xs text-slate-400 mt-1">Total active pharmaceutical products</p>
          </div>
        </div>

        {/* Low Stock count */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reorder Alerts</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{lowStockCount}</h3>
            <p className="text-xs text-slate-400 mt-1">Items running below safety thresholds</p>
          </div>
        </div>

        {/* Expiry alerts */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Expiry Alerts</span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{expiryCount}</h3>
            <p className="text-xs text-slate-400 mt-1">Batches expiring in &lt; 90 days</p>
          </div>
        </div>

        {/* Sales trend */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Revenue Trend</span>
            <div className="rounded-lg bg-teal-50 p-2 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50">+18.4%</h3>
            <p className="text-xs text-slate-400 mt-1">Growth rate over the past month</p>
          </div>
        </div>
      </div>

      {/* Main Charts & Registers Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales SVG Graph chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-6">Sales Performance</h2>
          <div className="h-64 w-full">
            {/* SVG responsive chart design */}
            <svg viewBox="0 0 500 200" className="w-full h-full text-emerald-500 overflow-visible">
              <defs>
                <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              <line x1="0" y1="50" x2="500" y2="50" stroke="#334155" strokeWidth="0.5" strokeDasharray="4" />
              <line x1="0" y1="100" x2="500" y2="100" stroke="#334155" strokeWidth="0.5" strokeDasharray="4" />
              <line x1="0" y1="150" x2="500" y2="150" stroke="#334155" strokeWidth="0.5" strokeDasharray="4" />
              
              {/* Filled graph path */}
              <path
                d="M 0 170 Q 100 130 150 140 T 300 80 T 400 90 T 500 40 L 500 200 L 0 200 Z"
                fill="url(#chart-grad)"
              />
              
              {/* Line graph path */}
              <path
                d="M 0 170 Q 100 130 150 140 T 300 80 T 400 90 T 500 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="transition-all hover:stroke-emerald-400"
              />
              {/* Data points */}
              <circle cx="150" cy="140" r="4" fill="#10b981" />
              <circle cx="300" cy="80" r="4" fill="#10b981" />
              <circle cx="500" cy="40" r="4" fill="#10b981" />
            </svg>
          </div>
          <div className="mt-4 flex justify-between text-[11px] text-slate-400 font-medium px-2">
            <span>Jan / Feb</span>
            <span>Mar / Apr</span>
            <span>May / Jun</span>
            <span>Jul / Aug</span>
            <span>Sep / Oct</span>
            <span>Nov / Dec</span>
          </div>
        </div>

        {/* Recent sales registers list */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Recent Transactions</h2>
            <Link href="/sales" className="text-xs font-semibold text-emerald-500 hover:text-emerald-400 flex items-center gap-0.5">
              History
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {recentSales.length > 0 ? (
              recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      {sale.customer_name || "General Walk-in"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {sale.payment_mode}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    ${sale.net_amount.toFixed(2)}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-between py-12 text-center text-slate-400">
                <CircleAlert className="h-8 w-8 text-slate-500 mb-2" />
                <p className="text-xs">No transactions recorded yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
