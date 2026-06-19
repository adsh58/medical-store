"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Upload, Sparkles, ShieldCheck, ShieldAlert, 
  ArrowUpRight, ArrowDownRight, Check, AlertTriangle, X
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { Agency } from "@/types";
import { useCurrency } from "@/hooks/useCurrency";

interface RateComparisonItem {
  medicine_id: string | null;
  medicine_name: string;
  batch_no: string;
  expiry_date: string;
  quantity: number;
  free_quantity: number;
  new_rate: number;
  old_rate: number;
  mrp: number;
  old_mrp: number;
  gst: number;
  price_changed: boolean;
  difference_percentage: number;
  trend: string;
  alert_triggered: boolean;
  alert_message: string | null;
  recommended_doctor_rate: number;
  recommended_customer_rate: number;
  company: string | null;
  pack_size: string | null;
  generic_name: string | null;
}

interface AIInvoiceAnalysisReport {
  file_name: string;
  invoice_number: string;
  supplier_name: string;
  invoice_date: string;
  extracted_items: RateComparisonItem[];
  total_increases: number;
  total_decreases: number;
}

export default function UploadInvoicePage() {
  const { formatCurrency, currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<AIInvoiceAnalysisReport | null>(null);
  const [itemsToCommit, setItemsToCommit] = useState<RateComparisonItem[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");
  
  // Duplicate Resolution States
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateMsg, setDuplicateMsg] = useState("");
  const [pendingExtractedData, setPendingExtractedData] = useState<AIInvoiceAnalysisReport | null>(null);
  const [conflictResolution, setConflictResolution] = useState<string | null>(null);

  // Price Changes Modal States
  const [priceModalOpen, setPriceModalOpen] = useState(false);

  // Queries
  const { data: agencies } = useQuery<Agency[]>({
    queryKey: ["upload-agencies"],
    queryFn: () => apiClient.get("/agencies").then(res => res.data)
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => 
      apiClient.post("/purchases/invoices/upload-ai", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      }).then(res => res.data),
    onSuccess: (data) => {
      const extractedReport = data.report;
      if (data.is_duplicate) {
        setDuplicateMsg(`Invoice "${extractedReport.invoice_number}" already logged for supplier "${extractedReport.supplier_name}".`);
        setPendingExtractedData(extractedReport);
        setDuplicateModalOpen(true);
      } else {
        setReport(extractedReport);
        setItemsToCommit(extractedReport.extracted_items);
        setConflictResolution(null);
        setFile(null);
      }
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "AI scanning extraction failed");
    }
  });

  // Commit Mutation
  const commitInvoiceMutation = useMutation({
    mutationFn: (data: any) => apiClient.post("/purchases/invoices/commit-ai", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
      setSuccessMsg("Invoice committed successfully! Stock levels, batches, and prices updated.");
      setReport(null);
      setItemsToCommit([]);
      setConflictResolution(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to commit invoice details");
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setReport(null);
      setItemsToCommit([]);
      setSuccessMsg(null);
    }
  };

  const handleUpload = () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    uploadMutation.mutate(formData);
  };

  const handleDuplicateResolve = (mode: "cancel" | "reprocess" | "replace") => {
    if (mode === "cancel") {
      setDuplicateModalOpen(false);
      setPendingExtractedData(null);
      setFile(null);
    } else {
      setConflictResolution(mode);
      if (pendingExtractedData) {
        setReport(pendingExtractedData);
        setItemsToCommit(pendingExtractedData.extracted_items);
      }
      setDuplicateModalOpen(false);
      setPendingExtractedData(null);
      setFile(null);
    }
  };

  const triggerCommitSubmit = (itemsPayload: RateComparisonItem[]) => {
    if (!report) return;
    const commitData = {
      agency_id: selectedAgencyId,
      invoice_number: report.invoice_number,
      invoice_date: report.invoice_date,
      conflict_resolution: conflictResolution,
      items: itemsPayload.map(item => ({
        medicine_id: item.medicine_id,
        medicine_name: item.medicine_name,
        batch_number: item.batch_no,
        quantity: item.quantity,
        free_quantity: item.free_quantity,
        expiry_date: item.expiry_date,
        mrp: item.mrp,
        purchase_rate: item.new_rate,
        gst: item.gst,
        doctor_rate: item.recommended_doctor_rate,
        customer_rate: item.recommended_customer_rate,
        company: item.company,
        pack_size: item.pack_size,
        generic_name: item.generic_name
      }))
    };
    commitInvoiceMutation.mutate(commitData);
    setPriceModalOpen(false);
  };

  const handleCommitClick = () => {
    if (!report) return;
    if (!selectedAgencyId) {
      alert("Please select a supplying agency first");
      return;
    }

    // Check if any items have price changes
    const hasPriceChanges = itemsToCommit.some(x => x.price_changed);
    if (hasPriceChanges) {
      setPriceModalOpen(true);
    } else {
      triggerCommitSubmit(itemsToCommit);
    }
  };

  const handlePriceChangeRateUpdate = (index: number, field: "recommended_doctor_rate" | "recommended_customer_rate", val: string) => {
    const numericVal = parseFloat(val) || 0;
    setItemsToCommit(prev => prev.map((item, idx) => {
      if (idx === index) {
        return {
          ...item,
          [field]: numericVal
        };
      }
      return item;
    }));
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

      {conflictResolution && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-950/35 border border-amber-900/50 p-3 text-xs text-amber-400">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <p>
            Conflict resolution mode active: <strong>{conflictResolution === "replace" ? "Replace Existing Invoice" : "Reprocess with unique suffix"}</strong>.
          </p>
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
              Extraction Preview Report: {report.invoice_number} ({report.invoice_date})
            </h2>
            <button
              onClick={() => {
                setReport(null);
                setItemsToCommit([]);
                setConflictResolution(null);
              }}
              className="text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              Scan Another File
            </button>
          </div>

          {/* Rate changes alerts list */}
          {itemsToCommit.some(x => x.alert_triggered) && (
            <div className="space-y-2">
              {itemsToCommit.filter(x => x.alert_triggered).map((item, idx) => (
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
                    <th className="px-6 py-4">Quantity (Free)</th>
                    <th className="px-6 py-4">MRP (Old MRP)</th>
                    <th className="px-6 py-4">Purchase Rate</th>
                    <th className="px-6 py-4">GST</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {itemsToCommit.map((item, index) => {
                    const isIncrease = item.trend === "INCREASED";
                    const isDecrease = item.trend === "DECREASED";
                    const isNew = item.trend === "NEW_MEDICINE";
                    return (
                      <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.medicine_name} {isNew && <span className="text-[10px] ml-1 rounded bg-blue-900 px-1 text-white font-normal">New</span>}
                          </p>
                          <p className="text-xs text-slate-450">{item.company || "Unknown Company"} | {item.pack_size || "Unknown Pack"}</p>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <p className="font-medium text-slate-700 dark:text-slate-300">B: {item.batch_no}</p>
                          <p className="text-slate-400">E: {item.expiry_date}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-650 dark:text-slate-350 font-medium">
                          {item.quantity} {item.free_quantity > 0 && <span className="text-xs text-emerald-500 font-semibold">(+{item.free_quantity} Free)</span>}
                        </td>
                        <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-medium">
                          {formatCurrency(item.mrp)} {item.old_mrp > 0 && item.old_mrp !== item.mrp && <span className="text-xs text-slate-400 line-through ml-1">{formatCurrency(item.old_mrp)}</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-950 dark:text-slate-50">{formatCurrency(item.new_rate)}</span>
                          {item.old_rate > 0 && (
                            <span className="text-xs text-slate-400 block">Old: {formatCurrency(item.old_rate)}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-650 dark:text-slate-350">{item.gst}%</td>
                        <td className="px-6 py-4">
                          {isIncrease ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-rose-950/20 px-2 py-1 text-xs font-semibold text-rose-450">
                              <ArrowUpRight className="h-3 w-3" />
                              +{item.difference_percentage}%
                            </span>
                          ) : isDecrease ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-950/20 px-2 py-1 text-xs font-semibold text-emerald-450">
                              <ArrowDownRight className="h-3 w-3" />
                              {item.difference_percentage}%
                            </span>
                          ) : isNew ? (
                            <span className="text-xs text-blue-400 font-medium">Auto-Create</span>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">Unchanged</span>
                          )}
                        </td>
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
                onClick={() => {
                  setReport(null);
                  setItemsToCommit([]);
                  setConflictResolution(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-655 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-350 dark:hover:bg-slate-850"
              >
                Discard Report
              </button>
              <button
                onClick={handleCommitClick}
                disabled={!selectedAgencyId || commitInvoiceMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {commitInvoiceMutation.isPending ? "Processing..." : "Approve & Update Inventory"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Duplicate Invoice Resolution Modal */}
      {duplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-500 mb-4">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">Duplicate Invoice Detected</h3>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              {duplicateMsg} Please specify how you would like to handle this conflict:
            </p>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleDuplicateResolve("replace")}
                className="w-full rounded-lg bg-rose-650 py-2.5 text-xs font-semibold text-white hover:bg-rose-550 transition-colors"
              >
                Replace Existing Invoice (Revert old inventory & overwrite)
              </button>
              <button
                onClick={() => handleDuplicateResolve("reprocess")}
                className="w-full rounded-lg bg-slate-800 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors border border-slate-700"
              >
                Reprocess Invoice (Import as new entry with unique suffix)
              </button>
              <button
                onClick={() => handleDuplicateResolve("cancel")}
                className="w-full rounded-lg bg-white py-2.5 text-xs font-semibold text-slate-655 hover:bg-slate-50 border border-slate-200 transition-colors dark:bg-slate-900 dark:border-slate-800 dark:text-slate-350 dark:hover:bg-slate-850"
              >
                Cancel & Discard Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Price Changes / Rates Confirmation Modal */}
      {priceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4 shrink-0">
              <div className="flex items-center gap-2 text-rose-550">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">Medicines with Price Changes Detected</h3>
              </div>
              <button 
                onClick={() => setPriceModalOpen(false)}
                className="text-slate-400 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 shrink-0">
              The following medicines have different purchase rates or MRPs compared to your current records. Review and adjust the recommended selling rates:
            </p>

            <div className="overflow-y-auto flex-1 pr-1 border border-slate-200 dark:border-slate-850 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900/60 sticky top-0 z-10">
                    <th className="px-4 py-3">Medicine</th>
                    <th className="px-4 py-3">Purchase Rate</th>
                    <th className="px-4 py-3">MRP</th>
                    <th className="px-4 py-3">Doctor Rate</th>
                    <th className="px-4 py-3">Customer Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {itemsToCommit.map((item, index) => {
                    if (!item.price_changed) return null;
                    return (
                      <tr key={index} className="hover:bg-slate-55/50 dark:hover:bg-slate-800/10">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{item.medicine_name}</p>
                          <p className="text-[10px] text-slate-450">{item.company}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-900 dark:text-slate-100 font-bold">{formatCurrency(item.new_rate)}</span>
                          <span className="text-[10px] text-slate-400 block">Was: {formatCurrency(item.old_rate)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-900 dark:text-slate-100 font-bold">{formatCurrency(item.mrp)}</span>
                          {item.old_mrp > 0 && <span className="text-[10px] text-slate-400 block">Was: {formatCurrency(item.old_mrp)}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={item.recommended_doctor_rate}
                              onChange={(e) => handlePriceChangeRateUpdate(index, "recommended_doctor_rate", e.target.value)}
                              className="rounded border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 p-1 w-20 text-xs font-semibold outline-none focus:border-emerald-500"
                            />
                            <span className="text-[9px] text-slate-400 block">Rec: {formatCurrency(item.new_rate * 1.15)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={item.recommended_customer_rate}
                              onChange={(e) => handlePriceChangeRateUpdate(index, "recommended_customer_rate", e.target.value)}
                              className="rounded border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 p-1 w-20 text-xs font-semibold outline-none focus:border-emerald-500"
                            />
                            <span className="text-[9px] text-slate-400 block">Rec: {formatCurrency(item.new_rate * 1.30)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setPriceModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-655 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-350 dark:hover:bg-slate-850"
              >
                Cancel
              </button>
              <button
                onClick={() => triggerCommitSubmit(itemsToCommit)}
                disabled={commitInvoiceMutation.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {commitInvoiceMutation.isPending ? "Saving..." : "Save Changes & Commit Stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
