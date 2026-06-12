"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, Sparkles, Pill, AlertCircle, HelpCircle, ArrowRight } from "lucide-react";
import apiClient from "@/lib/api-client";
import { AssistantSearchItem } from "@/types";
import Link from "next/link";

export default function SearchAssistantPage() {
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<AssistantSearchItem[]>([]);

  // Mutations
  const searchMutation = useMutation({
    mutationFn: (searchQuery: string) => 
      apiClient.post("/medicines/assistant-search", { query: searchQuery }).then(res => res.data),
    onSuccess: (data) => {
      setResults(data.items || []);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "AI Assistant search request failed");
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    searchMutation.mutate(query);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-emerald-600 p-2.5 text-white">
          <Sparkles className="h-6 w-6 animate-pulse" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">AI Medicine Assistant</h1>
          <p className="text-sm text-slate-500">
            Identify brand name medicines in stock using symptoms, generic ingredients, or medical conditions.
          </p>
        </div>
      </div>

      {/* Query Search Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleSearch} className="space-y-4">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Ask Assistant (Symptom or Substance)
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., fever tablet, paracetamol, medicine for blood pressure..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pr-4 pl-10 text-sm outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 dark:border-slate-850 dark:bg-slate-950 text-slate-200"
                required
              />
            </div>
            <button
              type="submit"
              disabled={searchMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {searchMutation.isPending ? "Analyzing..." : "Ask AI"}
            </button>
          </div>
          
          {/* Quick suggestions chips */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Suggestions:</span>
            {["fever tablet", "painkiller", "paracetamol", "blood pressure", "infection"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuery(s);
                  searchMutation.mutate(s);
                }}
                className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-350 dark:hover:bg-slate-750"
              >
                {s}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Results Display */}
      <div className="space-y-4">
        {searchMutation.isPending ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center dark:border-slate-800 dark:bg-slate-900 shadow-sm flex flex-col items-center justify-between">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent mb-3" />
            <p className="text-xs text-slate-400 font-medium">Gemini AI is scanning matching medicines catalog...</p>
          </div>
        ) : searchMutation.isSuccess && results.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider px-1">Matching Results ({results.length})</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {results.map((item) => (
                <div 
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                          <Pill className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.name}</h3>
                          <p className="text-[11px] text-slate-400">{item.company} • {item.pack_size}</p>
                        </div>
                      </div>
                      <span className="rounded bg-emerald-950/20 px-2 py-0.5 text-[10px] font-bold text-emerald-450">
                        {Math.round(item.confidence * 100)}% Match
                      </span>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-800" />

                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Generic Ingredient</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.generic_name}</p>
                    </div>

                    <div className="space-y-1 bg-slate-50 dark:bg-slate-950/40 rounded-lg p-2.5 border border-slate-150 dark:border-slate-850">
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        Assistant Reason
                      </p>
                      <p className="text-xs text-slate-605 dark:text-slate-350 leading-relaxed">
                        {item.matching_reason}
                      </p>
                    </div>

                    {/* Emergency Batch & Coordinates Detail */}
                    <div className="space-y-2 mt-3 pt-2 border-t border-dashed border-slate-150 dark:border-slate-800/60">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available Batches & Coordinates</p>
                      {item.batches && item.batches.length > 0 ? (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {item.batches.map((batch) => {
                            const isLow = batch.current_stock <= batch.reorder_level;
                            const expDate = new Date(batch.expiry_date);
                            const today = new Date();
                            const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            let expStatus = "Normal";
                            let expColor = "text-emerald-500 bg-emerald-950/20";
                            if (diffDays <= 0) {
                              expStatus = "Expired";
                              expColor = "text-rose-500 bg-rose-950/20";
                            } else if (diffDays <= 30) {
                              expStatus = "Critical <30d";
                              expColor = "text-rose-400 bg-rose-950/25";
                            } else if (diffDays <= 90) {
                              expStatus = "Warning <90d";
                              expColor = "text-amber-500 bg-amber-950/20";
                            }

                            return (
                              <div key={batch.id} className="p-2 rounded border border-slate-100 dark:border-slate-850 bg-slate-50/40 dark:bg-slate-900/10 text-[11px] space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-700 dark:text-slate-205">B: {batch.batch_number}</span>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${expColor}`}>{expStatus}</span>
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 flex flex-wrap justify-between gap-x-2">
                                  <span className={isLow ? 'text-amber-500 font-bold' : ''}>Stock: {batch.current_stock} units</span>
                                  <span>Exp: {expDate.toLocaleDateString()}</span>
                                </div>
                                <div className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] mt-0.5 pt-0.5 border-t border-slate-100 dark:border-slate-850/50">
                                  Location: {batch.location_coordinate}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">No active stock/batches found in system inventory.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Retail Price</p>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${item.customer_selling_rate.toFixed(2)}</p>
                    </div>
                    <Link
                      href="/inventory"
                      className="inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 px-2.5 py-1.5 text-[11px] font-bold text-slate-655 dark:text-slate-300"
                    >
                      Locate Shelf
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : searchMutation.isSuccess && results.length === 0 ? (
          <div className="rounded-xl border border-slate-250 bg-white py-12 text-center dark:border-slate-800 dark:bg-slate-900 shadow-sm text-slate-400">
            <AlertCircle className="h-8 w-8 text-slate-500 mx-auto mb-2" />
            <h3 className="text-xs font-semibold">No matches found</h3>
            <p className="text-[11px] text-slate-500 mt-1">Try searching another query or add the brand to catalog.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/10">
            <HelpCircle className="h-8 w-8 text-slate-500 mx-auto mb-2" />
            <h3 className="text-xs font-semibold">Ready for queries</h3>
            <p className="text-[11px] text-slate-500 mt-1">Type in a condition, generic name, or symptom to search brands in stock.</p>
          </div>
        )}
      </div>
    </div>
  );
}
