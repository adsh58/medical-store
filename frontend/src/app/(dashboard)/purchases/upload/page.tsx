"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Upload, Sparkles, ShieldCheck, ShieldAlert, 
  ArrowUpRight, ArrowDownRight, Check, RefreshCw 
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { AIInvoiceAnalysisReport, Agency } from "@/types";

export default function UploadInvoicePage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<AIInvoiceAnalysisReport | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");

  // Queries
  const { data: agencies } = useQuery<Agency[]>({
    queryKey: ["upload-agencies"],
    queryFn: () => apiClient.get("/agencies").then(res => res.data)
  });

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => 
      apiClient.post("/purchases/invoices/upload-ai", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      }).then(res => res.data),
    onSuccess: (data) => {
      // API returns report directly or inside extracted_data key
      const extracted = data.extracted_data || data;
      setReport(extracted);
      setFile(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "AI scanning extraction failed");
    }
  });

  const commitInvoiceMutation = useMutation({
    mutationFn: (data: any) => apiClient.post("/purchases/invoices", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      setSuccessMsg("Invoice committed successfully! Stock levels and price logs updated.");
      setReport(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to commit invoice details");
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setReport(null);
      setSuccessMsg(null);
    }
  };

  const handleUpload = () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    uploadMutation.mutate(formData);
  };

  const handleCommit = () => {
    if (!report) return;
    if (!selectedAgencyId) {
      alert("Please select a supplying agency first");
      return;
    }
    // Map extracted AI items to standard InvoiceCreate structures
    const commitData = {
      agency_id: selectedAgencyId,
      invoice_number: report.file_name.replace(".pdf", "-AI"),
      invoice_date: new Date().toISOString().split("T")[0],
      total_amount: report.extracted_items.reduce((sum, item) => sum + (item.new_rate * item.quantity), 0),
      items: report.extracted_items.map((item) => ({
        medicine_id: item.medicine_id || "00000000-0000-0000-0000-000000000000",
        batch_number: item.batch_no,
        quantity: item.quantity,
        purchase_rate: item.new_rate,
        expiry_date: item.expiry_date
      }))
    };
    commitInvoiceMutation.mutate(commitData);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">AI Invoice Upload</h1>
        <p className="text-sm text-slate-500">Scan billing invoices via Gemini OCR and dynamically audit purchase price increases.</p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/35 border border-emerald-900/50 p-3 text-xs text-emerald-450">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* Upload layout panel */}
      {!report ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 max-w-2xl">
          <div className="flex flex-col items-center justify-between border-2 border-dashed border-slate-200 rounded-xl p-8 text-center dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
            <Upload className="h-10 w-10 text-slate-400 mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-350">Choose Invoice Document</p>
            <p className="text-xs text-slate-400 mt-1 mb-6">Supports PDF files or image snapshots (JPG, PNG)</p>
            
            <input
              type="file"
              id="invoice-file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <label
              htmlFor="invoice-file"
              className="rounded-lg border border-slate-250 bg-white px-4 py-2 text-xs font-semibold text-slate-650 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-850 cursor-pointer"
            >
              Select File
            </label>

            {file && (
              <p className="mt-4 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={!file || uploadMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {uploadMutation.isPending ? "AI Processing..." : "Scan & Extract Data"}
            </button>
          </div>
        </div>
      ) : (
        /* Report Render panel */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              Extraction Audit Report: {report.file_name}
            </h2>
            <button
              onClick={() => setReport(null)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              Scan Another File
            </button>
          </div>

          {/* Rate changes alerts list */}
          {report.extracted_items.some(x => x.alert_triggered) && (
            <div className="space-y-2">
              {report.extracted_items.filter(x => x.alert_triggered).map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg bg-rose-950/20 border border-rose-900/50 p-3 text-xs text-rose-400">
                  <ShieldAlert className="h-4 w-4 shrink-0 animate-bounce" />
                  <p>{item.alert_message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Extracted items mapping table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900/60">
                    <th className="px-6 py-4">Medicine Info</th>
                    <th className="px-6 py-4">Batch / Expiry</th>
                    <th className="px-6 py-4">Quantity</th>
                    <th className="px-6 py-4">Old Purchase Rate</th>
                    <th className="px-6 py-4">New Purchase Rate</th>
                    <th className="px-6 py-4">Margin Trend</th>
                    <th className="px-6 py-4">Doctor Recommended</th>
                    <th className="px-6 py-4">Customer Recommended</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {report.extracted_items.map((item, index) => {
                    const isIncrease = item.trend === "INCREASED";
                    const isDecrease = item.trend === "DECREASED";
                    return (
                      <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{item.medicine_name}</p>
                          <p className="text-xs text-slate-450">{item.pack_size}</p>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <p className="font-medium text-slate-700 dark:text-slate-300">B: {item.batch_no}</p>
                          <p className="text-slate-400">E: {item.expiry_date}</p>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-650 dark:text-slate-350">{item.quantity}</td>
                        <td className="px-6 py-4 text-slate-400">${item.old_rate.toFixed(2)}</td>
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">${item.new_rate.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          {isIncrease ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-rose-950/20 px-2 py-1 text-xs font-semibold text-rose-400">
                              <ArrowUpRight className="h-3 w-3" />
                              +{item.difference_percentage}%
                            </span>
                          ) : isDecrease ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-950/20 px-2 py-1 text-xs font-semibold text-emerald-450">
                              <ArrowDownRight className="h-3 w-3" />
                              {item.difference_percentage}%
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-slate-400">Unchanged</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-semibold">${item.recommended_doctor_rate.toFixed(2)}</td>
                        <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">${item.recommended_customer_rate.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Select Supplying Agency (Supplier)
              </label>
              <select
                value={selectedAgencyId}
                onChange={(e) => setSelectedAgencyId(e.target.value)}
                className="rounded border border-slate-200 bg-white p-2 text-xs outline-none dark:border-slate-800 dark:bg-slate-950 w-full sm:w-64"
              >
                <option value="">Choose Supplier Agency</option>
                {agencies?.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-2 self-end sm:self-auto">
              <button
                onClick={() => setReport(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-655 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-350 dark:hover:bg-slate-850"
              >
                Discard Report
              </button>
              <button
                onClick={handleCommit}
                disabled={!selectedAgencyId || commitInvoiceMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {commitInvoiceMutation.isPending ? "Committing..." : "Approve & Update Inventory"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
