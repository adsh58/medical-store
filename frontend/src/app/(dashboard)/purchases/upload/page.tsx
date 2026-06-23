"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Upload, Sparkles, ShieldCheck, ShieldAlert, 
  ArrowUpRight, ArrowDownRight, Check, AlertTriangle, X, Info
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
  confidence: number;
  needs_review: boolean;
  review_reasons: string[];
  category_id: string | null;
}

interface AIInvoiceAnalysisReport {
  file_name: string;
  invoice_number: string;
  supplier_name: string;
  invoice_date: string;
  extracted_items: RateComparisonItem[];
  total_increases: number;
  total_decreases: number;
  supplier_id: string | null;
  supplier_address: string | null;
  supplier_city: string | null;
  supplier_state: string | null;
  supplier_gst: string | null;
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

  // Queries
  const { data: agencies } = useQuery<Agency[]>({
    queryKey: ["upload-agencies"],
    queryFn: () => apiClient.get("/agencies").then(res => res.data)
  });

  const { data: categories } = useQuery<any[]>({
    queryKey: ["upload-categories"],
    queryFn: () => apiClient.get("/medicines/categories").then(res => res.data)
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
        setItemsToCommit(extractedReport.extracted_items || []);
        if (extractedReport.supplier_id) {
          setSelectedAgencyId(extractedReport.supplier_id);
        }
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
      queryClient.invalidateQueries({ queryKey: ["upload-agencies"] });
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
        setItemsToCommit(pendingExtractedData.extracted_items || []);
        if (pendingExtractedData.supplier_id) {
          setSelectedAgencyId(pendingExtractedData.supplier_id);
        }
      }
      setDuplicateModalOpen(false);
      setPendingExtractedData(null);
      setFile(null);
    }
  };

  const handleItemFieldChange = (index: number, field: keyof RateComparisonItem, value: any) => {
    setItemsToCommit(prev => prev.map((item, idx) => {
      if (idx === index) {
        let parsedValue = value;
        // Parse numbers if applicable
        if (["quantity", "free_quantity"].includes(field)) {
          parsedValue = parseInt(value) || 0;
        } else if (["new_rate", "mrp", "gst", "recommended_doctor_rate", "recommended_customer_rate"].includes(field)) {
          parsedValue = parseFloat(value) || 0;
        }
        
        const updatedItem = {
          ...item,
          [field]: parsedValue
        };
        
        // Dynamically compute trend/difference_percentage if new_rate or old_rate changes
        if (field === "new_rate") {
          const old_rate = updatedItem.old_rate;
          const new_rate = updatedItem.new_rate;
          if (old_rate > 0) {
            const diff = ((new_rate - old_rate) / old_rate) * 100.0;
            updatedItem.difference_percentage = parseFloat(diff.toFixed(2));
            if (new_rate > old_rate) {
              updatedItem.trend = "INCREASED";
              updatedItem.alert_triggered = true;
              updatedItem.alert_message = `PRICE INCREASE ALERT: '${updatedItem.medicine_name}' purchase rate rose from ${old_rate} to ${new_rate} (+${updatedItem.difference_percentage}%)`;
            } else if (new_rate < old_rate) {
              updatedItem.trend = "DECREASED";
              updatedItem.alert_triggered = false;
              updatedItem.alert_message = `PRICE REDUCTION: '${updatedItem.medicine_name}' purchase rate fell from ${old_rate} to ${new_rate} (${updatedItem.difference_percentage}%)`;
            } else {
              updatedItem.trend = "UNCHANGED";
              updatedItem.alert_triggered = false;
              updatedItem.alert_message = null;
            }
          }
          // Recalculate recommendations
          updatedItem.recommended_doctor_rate = parseFloat(Math.min(new_rate * 1.15, updatedItem.mrp).toFixed(2));
          updatedItem.recommended_customer_rate = parseFloat(Math.min(new_rate * 1.30, updatedItem.mrp).toFixed(2));
          updatedItem.price_changed = new_rate !== old_rate;
        }
        
        if (field === "mrp") {
          // Re-verify doctor/customer rates don't exceed MRP
          updatedItem.recommended_doctor_rate = parseFloat(Math.min(updatedItem.recommended_doctor_rate, updatedItem.mrp).toFixed(2));
          updatedItem.recommended_customer_rate = parseFloat(Math.min(updatedItem.recommended_customer_rate, updatedItem.mrp).toFixed(2));
          updatedItem.price_changed = updatedItem.new_rate !== updatedItem.old_rate || updatedItem.mrp !== updatedItem.old_mrp;
        }

        // Dynamically run row warning checks
        updatedItem.review_reasons = [];
        if (updatedItem.confidence < 0.9) {
          updatedItem.review_reasons.push(`Low OCR confidence (${Math.round(updatedItem.confidence * 100)}%)`);
        }
        if (updatedItem.mrp < updatedItem.new_rate) {
          updatedItem.review_reasons.push(`MRP (${updatedItem.mrp}) is less than Purchase Rate (${updatedItem.new_rate})`);
        }
        if (updatedItem.old_rate > 0) {
          const price_diff_pct = Math.abs(updatedItem.new_rate - updatedItem.old_rate) / updatedItem.old_rate;
          if (price_diff_pct > 0.50) {
            updatedItem.review_reasons.push(`Purchase rate changed drastically by ${Math.round(price_diff_pct * 100)}% (from ${updatedItem.old_rate} to ${updatedItem.new_rate})`);
          }
        }
        updatedItem.needs_review = updatedItem.review_reasons.length > 0;

        return updatedItem;
      }
      return item;
    }));
  };

  const handleCommitSubmit = () => {
    if (!report) return;
    if (!selectedAgencyId) {
      alert("Please select a supplying agency first");
      return;
    }

    const commitData = {
      agency_id: selectedAgencyId,
      invoice_number: report.invoice_number,
      invoice_date: report.invoice_date,
      conflict_resolution: conflictResolution,
      items: itemsToCommit.map(item => ({
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
        generic_name: item.generic_name,
        category_id: item.category_id
      }))
    };
    commitInvoiceMutation.mutate(commitData);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">AI Invoice Upload</h1>
        <p className="text-sm text-slate-500">Scan billing invoices via Gemini OCR and dynamically update your medical store inventory.</p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/35 border border-emerald-900/50 p-3 text-xs text-emerald-400">
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
              className="rounded-lg border border-slate-250 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-850 cursor-pointer"
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
              Extraction Preview: {report.invoice_number} ({report.invoice_date})
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

          {/* Extracted items mapping table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900/60">
                    <th className="px-4 py-3 min-w-[200px]">Medicine Info</th>
                    <th className="px-4 py-3 min-w-[120px]">Batch / Expiry</th>
                    <th className="px-4 py-3 min-w-[120px]">Quantity (Free)</th>
                    <th className="px-4 py-3 min-w-[100px]">Purchase Rate (GST)</th>
                    <th className="px-4 py-3 min-w-[90px]">MRP</th>
                    <th className="px-4 py-3 min-w-[170px]">Selling Rates (Doc / Cust)</th>
                    <th className="px-4 py-3 min-w-[100px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {itemsToCommit.map((item, index) => {
                    const isNew = item.medicine_id === null;
                    const isIncrease = item.trend === "INCREASED";
                    const isDecrease = item.trend === "DECREASED";

                    return (
                      <tr 
                        key={index} 
                        className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors ${
                          item.needs_review 
                            ? "bg-amber-500/5 dark:bg-amber-500/5 border-l-4 border-l-amber-500" 
                            : ""
                        }`}
                      >
                        {/* Medicine Info */}
                        <td className="px-4 py-3 space-y-1">
                          <input
                            type="text"
                            value={item.medicine_name}
                            onChange={(e) => handleItemFieldChange(index, "medicine_name", e.target.value)}
                            className="w-full rounded border border-slate-200 dark:border-slate-800 bg-transparent px-1.5 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <div className="grid grid-cols-2 gap-1">
                            <input
                              type="text"
                              value={item.company || ""}
                              placeholder="Company"
                              onChange={(e) => handleItemFieldChange(index, "company", e.target.value)}
                              className="rounded border border-slate-200 dark:border-slate-800 bg-transparent px-1 py-0.5 text-[10px] text-slate-500 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={item.pack_size || ""}
                              placeholder="Pack Size"
                              onChange={(e) => handleItemFieldChange(index, "pack_size", e.target.value)}
                              className="rounded border border-slate-200 dark:border-slate-800 bg-transparent px-1 py-0.5 text-[10px] text-slate-500 focus:outline-none"
                            />
                          </div>
                          <input
                            type="text"
                            value={item.generic_name || ""}
                            placeholder="Generic / Composition"
                            onChange={(e) => handleItemFieldChange(index, "generic_name", e.target.value)}
                            className="w-full rounded border border-slate-200 dark:border-slate-800 bg-transparent px-1 py-0.5 text-[10px] text-slate-500 focus:outline-none"
                          />
                          {isNew && (
                            <div className="pt-1">
                              <label className="text-[9px] font-bold text-blue-500 dark:text-blue-400 block mb-0.5">NEW MEDICINE CATEGORY</label>
                              <select
                                value={item.category_id || ""}
                                onChange={(e) => handleItemFieldChange(index, "category_id", e.target.value)}
                                className="w-full rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-1 py-0.5 text-[10px]"
                              >
                                <option value="">Select Category</option>
                                {categories?.map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          
                          {/* Row validation messages */}
                          {item.needs_review && (
                            <div className="mt-1 space-y-0.5">
                              {item.review_reasons.map((reason, rIdx) => (
                                <div key={rIdx} className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Batch & Expiry */}
                        <td className="px-4 py-3 space-y-1">
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Batch</span>
                            <input
                              type="text"
                              value={item.batch_no}
                              onChange={(e) => handleItemFieldChange(index, "batch_no", e.target.value)}
                              className="w-full rounded border border-slate-200 dark:border-slate-800 bg-transparent px-1 py-0.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Expiry</span>
                            <input
                              type="date"
                              value={item.expiry_date}
                              onChange={(e) => handleItemFieldChange(index, "expiry_date", e.target.value)}
                              className="w-full rounded border border-slate-200 dark:border-slate-800 bg-transparent px-1 py-0.5 text-xs text-slate-750 focus:outline-none"
                            />
                          </div>
                        </td>

                        {/* Quantity (Free) */}
                        <td className="px-4 py-3 space-y-1">
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Qty</span>
                            <input
                              type="number"
                              value={item.quantity}
                              min="1"
                              onChange={(e) => handleItemFieldChange(index, "quantity", e.target.value)}
                              className="w-full rounded border border-slate-200 dark:border-slate-800 bg-transparent px-1 py-0.5 text-xs text-slate-750 focus:outline-none"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Free Qty</span>
                            <input
                              type="number"
                              value={item.free_quantity}
                              min="0"
                              onChange={(e) => handleItemFieldChange(index, "free_quantity", e.target.value)}
                              className="w-full rounded border border-slate-200 dark:border-slate-800 bg-transparent px-1 py-0.5 text-xs text-slate-750 focus:outline-none"
                            />
                          </div>
                        </td>

                        {/* Purchase Rate (GST) */}
                        <td className="px-4 py-3 space-y-1">
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Rate ({currencySymbol})</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.new_rate}
                              min="0.01"
                              onChange={(e) => handleItemFieldChange(index, "new_rate", e.target.value)}
                              className="w-full rounded border border-slate-200 dark:border-slate-800 bg-transparent px-1 py-0.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
                            />
                            {item.old_rate > 0 && (
                              <span className="text-[9px] text-slate-400 block">Old: {formatCurrency(item.old_rate)}</span>
                            )}
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">GST (%)</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.gst}
                              min="0"
                              onChange={(e) => handleItemFieldChange(index, "gst", e.target.value)}
                              className="w-full rounded border border-slate-200 dark:border-slate-800 bg-transparent px-1 py-0.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                            />
                          </div>
                        </td>

                        {/* MRP */}
                        <td className="px-4 py-3">
                          <span className="text-[9px] text-slate-400 block font-semibold uppercase">MRP ({currencySymbol})</span>
                          <input
                            type="number"
                            step="0.01"
                            value={item.mrp}
                            min="0.01"
                            onChange={(e) => handleItemFieldChange(index, "mrp", e.target.value)}
                            className="w-full rounded border border-slate-200 dark:border-slate-800 bg-transparent px-1 py-0.5 text-xs text-slate-750 focus:outline-none"
                          />
                          {item.old_mrp > 0 && item.old_mrp !== item.mrp && (
                            <span className="text-[9px] text-slate-400 block line-through">Old: {formatCurrency(item.old_mrp)}</span>
                          )}
                        </td>

                        {/* Selling Rates */}
                        <td className="px-4 py-3 space-y-1">
                          <div>
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] text-slate-400 font-semibold uppercase">Doctor ({currencySymbol})</span>
                              <span className="text-[9px] text-slate-400 font-normal">Rec: {formatCurrency(item.new_rate * 1.15)}</span>
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              value={item.recommended_doctor_rate}
                              min="0.01"
                              onChange={(e) => handleItemFieldChange(index, "recommended_doctor_rate", e.target.value)}
                              className="w-full rounded border border-slate-200 dark:border-slate-800 bg-transparent px-1.5 py-0.5 text-xs font-semibold text-slate-750 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] text-slate-400 font-semibold uppercase">Customer ({currencySymbol})</span>
                              <span className="text-[9px] text-slate-400 font-normal">Rec: {formatCurrency(item.new_rate * 1.30)}</span>
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              value={item.recommended_customer_rate}
                              min="0.01"
                              onChange={(e) => handleItemFieldChange(index, "recommended_customer_rate", e.target.value)}
                              className="w-full rounded border border-slate-200 dark:border-slate-800 bg-transparent px-1.5 py-0.5 text-xs font-semibold text-slate-750 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {isIncrease ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-rose-950/20 px-2 py-1 text-[10px] font-semibold text-rose-450">
                              <ArrowUpRight className="h-3 w-3" />
                              +{item.difference_percentage}%
                            </span>
                          ) : isDecrease ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-950/20 px-2 py-1 text-[10px] font-semibold text-emerald-450">
                              <ArrowDownRight className="h-3 w-3" />
                              {item.difference_percentage}%
                            </span>
                          ) : isNew ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-blue-950/20 px-2 py-1 text-[10px] font-semibold text-blue-400">
                              Auto-Create
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">Unchanged</span>
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
                    {agency.display_name || agency.name}
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
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-55 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-350 dark:hover:bg-slate-850"
              >
                Discard Report
              </button>
              <button
                onClick={handleCommitSubmit}
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

      {/* Duplicate Invoice Resolution Modal */}
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
                className="w-full rounded-lg bg-rose-600 py-2.5 text-xs font-semibold text-white hover:bg-rose-500 transition-colors"
              >
                Replace Existing Invoice (Revert old inventory & overwrite)
              </button>
              <button
                onClick={() => handleDuplicateResolve("reprocess")}
                className="w-full rounded-lg bg-slate-800 py-2.5 text-xs font-semibold text-slate-250 hover:bg-slate-700 transition-colors border border-slate-700"
              >
                Reprocess Invoice (Import as new entry with unique suffix)
              </button>
              <button
                onClick={() => handleDuplicateResolve("cancel")}
                className="w-full rounded-lg bg-white py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 transition-colors dark:bg-slate-900 dark:border-slate-800 dark:text-slate-350 dark:hover:bg-slate-850"
              >
                Cancel & Discard Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
