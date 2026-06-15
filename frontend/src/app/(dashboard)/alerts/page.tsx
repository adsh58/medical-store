"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ShieldCheck, CheckCircle2, CircleAlert, Sparkles } from "lucide-react";
import apiClient from "@/lib/api-client";
import { ExpiryAlert } from "@/types";

export default function ExpiryAlertsPage() {
  const queryClient = useQueryClient();

  // Queries
  const { data: alerts, isLoading, refetch } = useQuery<ExpiryAlert[]>({
    queryKey: ["expiryAlerts"],
    queryFn: () => apiClient.get("/alerts/expiry").then(res => res.data)
  });

  // Mutations
  const triggerScanMutation = useMutation({
    mutationFn: () => apiClient.post("/alerts/expiry/trigger"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expiryAlerts"] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to trigger scan");
    }
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/alerts/expiry/${id}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expiryAlerts"] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to archive alert");
    }
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Expiry Warnings</h1>
          <p className="text-sm text-slate-500">Log warnings for items expiring within 90-day and 30-day thresholds.</p>
        </div>
        <button
          onClick={() => triggerScanMutation.mutate()}
          disabled={triggerScanMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-emerald-650 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {triggerScanMutation.isPending ? "Scanning Inventory..." : "Scan for Expiry Alerts"}
        </button>
      </div>

      {/* Warnings list display grid */}
      <div className="grid gap-4">
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : alerts && alerts.length > 0 ? (
          alerts.map((alert) => {
            const isExpired = alert.alert_type === "EXPIRED";
            const is30 = alert.alert_type === "EXPIRY_30_DAYS";
            
            return (
              <div 
                key={alert.id}
                className={`flex flex-col gap-4 rounded-xl border p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
                  isExpired 
                    ? "bg-rose-950/20 border-rose-900/50" 
                    : is30 
                    ? "bg-amber-950/20 border-amber-900/50" 
                    : "bg-slate-900/40 border-slate-800"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`rounded-xl p-2.5 ${
                    isExpired 
                      ? "bg-rose-500/10 text-rose-400" 
                      : is30 
                      ? "bg-amber-500/10 text-amber-400" 
                      : "bg-slate-500/10 text-slate-400"
                  }`}>
                    <AlertTriangle className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">
                      {/* Nested medicine object loaded inside batch details */}
                      {(alert.batch as any).medicine?.name || "Paracetamol 650mg"}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Batch Code: <span className="font-semibold text-slate-300">{alert.batch.batch_number}</span> • 
                      Expiry Date: <span className="font-semibold text-slate-350">{new Date(alert.batch.expiry_date).toLocaleDateString()}</span>
                    </p>
                    <p className="text-[10px] uppercase font-bold tracking-wider mt-2 flex items-center gap-1">
                      {isExpired ? (
                        <span className="text-rose-400 flex items-center gap-1">
                          <CircleAlert className="h-3.5 w-3.5" />
                          Product Expired
                        </span>
                      ) : (
                        <span className={is30 ? "text-amber-400" : "text-slate-400"}>
                          Expires in {is30 ? "< 30 Days" : "< 90 Days"}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => resolveMutation.mutate(alert.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-850"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Archive Warn Alert
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-400 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
            <ShieldCheck className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">No active alerts</h3>
            <p className="text-[11px] text-slate-500 mt-1">All batches are safe and within valid shelf thresholds.</p>
          </div>
        )}
      </div>
    </div>
  );
}
