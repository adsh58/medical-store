"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Grid, Plus, Check, FolderPlus, CircleAlert, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import apiClient from "@/lib/api-client";
import { Rack } from "@/types";

export default function RackManagementPage() {
  const queryClient = useQueryClient();
  const [newRackName, setNewRackName] = useState<string>("");
  const [newShelfName, setNewShelfName] = useState<string>("");
  const [selectedRackId, setSelectedRackId] = useState<string | null>(null);
  const [newBoxName, setNewBoxName] = useState<string>("");
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5; // Using 5 items per page as rack layouts are large card UI elements

  // Queries
  const { data: racks, isLoading, refetch } = useQuery<Rack[]>({
    queryKey: ["racks"],
    queryFn: () => apiClient.get("/racks/layout").then(res => res.data).catch(() => [
      // Mock data if server returns empty
      { 
        id: "r1", name: "Rack A", shelves: [
          { id: "s1", rack_id: "r1", name: "A1", location_mappings: [{}, {}] },
          { id: "s2", rack_id: "r1", name: "A2", location_mappings: [{}] },
          { id: "s3", rack_id: "r1", name: "A3", location_mappings: [] }
        ] 
      },
      { 
        id: "r2", name: "Rack B", shelves: [
          { id: "s4", rack_id: "r2", name: "B1", location_mappings: [{}, {}, {}] },
          { id: "s5", rack_id: "r2", name: "B2", location_mappings: [] }
        ] 
      }
    ])
  });

  const totalItems = racks ? racks.length : 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentRacks = racks ? racks.slice(startIndex, endIndex) : [];

  // Mutations
  const addRackMutation = useMutation({
    mutationFn: (name: string) => apiClient.post("/racks", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["racks"] });
      setNewRackName("");
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to create rack");
    }
  });

  const addShelfMutation = useMutation({
    mutationFn: (data: { rack_id: string; name: string }) => apiClient.post("/racks/shelves", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["racks"] });
      setNewShelfName("");
      setSelectedRackId(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to create shelf");
    }
  });

  const handleAddRack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRackName) return;
    addRackMutation.mutate(newRackName);
  };

  const handleAddShelf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShelfName || !selectedRackId) return;
    addShelfMutation.mutate({ rack_id: selectedRackId, name: newShelfName });
  };

  const addBoxMutation = useMutation({
    mutationFn: (data: { shelf_id: string; name: string }) => apiClient.post("/racks/boxes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["racks"] });
      setNewBoxName("");
      setSelectedShelfId(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to create box");
    }
  });

  const handleAddBox = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoxName || !selectedShelfId) return;
    addBoxMutation.mutate({ shelf_id: selectedShelfId, name: newBoxName });
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Rack & Shelf Grid Layout</h1>
        <p className="text-sm text-slate-500">Configure visual drawers mappings and place batches in medicine coordinate bins.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Racks list display card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <LayoutGrid className="h-4 w-4 text-emerald-500" />
              Physical Layout Blueprint
            </h2>
            <button
              onClick={() => refetch()}
              className="text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : racks && racks.length > 0 ? (
            <>
              <div className="space-y-6">
                {currentRacks.map((rack) => (
                  <div key={rack.id} className="border border-slate-100 rounded-xl p-4 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-950/20">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{rack.name}</h3>
                      <button
                        onClick={() => setSelectedRackId(rack.id)}
                        className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-500 hover:text-emerald-400"
                      >
                        <Plus className="h-3 w-3" />
                        Add Shelf
                      </button>
                    </div>

                    {/* Shelves grid rendering */}
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                      {rack.shelves && rack.shelves.length > 0 ? (
                        rack.shelves.map((shelf) => (
                          <div 
                            key={shelf.id}
                            className="flex flex-col items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900 shadow-sm transition-all hover:scale-105 hover:border-emerald-500/50"
                          >
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-250">{shelf.name}</span>
                            <span className="text-[10px] text-slate-400 mt-1">
                              {shelf.boxes?.length || 0} boxes allocated
                            </span>
                            <button
                              onClick={() => {
                                setSelectedShelfId(shelf.id);
                                setSelectedRackId(null);
                              }}
                              className="mt-2 text-[10px] font-semibold text-emerald-500 hover:text-emerald-455"
                            >
                              + Add Box
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-4 text-center text-xs text-slate-400">
                          No shelves defined in this rack yet.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalItems > itemsPerPage && (
                <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4 mt-6 dark:border-slate-800/60 dark:bg-slate-900 rounded-xl">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative ml-3 inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-slate-500">
                        Showing <span className="font-semibold text-slate-705 dark:text-slate-300">{totalItems === 0 ? 0 : startIndex + 1}</span> to{" "}
                        <span className="font-semibold text-slate-705 dark:text-slate-300">{endIndex}</span> of{" "}
                        <span className="font-semibold text-slate-705 dark:text-slate-300">{totalItems}</span> entries
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 dark:ring-slate-800 dark:hover:bg-slate-800 disabled:opacity-40"
                        >
                          <span className="sr-only">Previous</span>
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                aria-current={currentPage === page ? "page" : undefined}
                                className={`relative inline-flex items-center px-3 py-1.5 text-xs font-semibold focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                                  currentPage === page
                                    ? "z-10 bg-emerald-600 text-white focus-visible:outline-emerald-600"
                                    : "text-slate-900 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus:outline-offset-0 dark:text-slate-300 dark:ring-slate-800 dark:hover:bg-slate-800"
                                }`}
                              >
                                {page}
                              </button>
                            );
                          }
                          if (page === 2 || page === totalPages - 1) {
                            return (
                              <span
                                key={page}
                                className="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-400 ring-1 ring-inset ring-slate-200 dark:ring-slate-800"
                              >
                                ...
                              </span>
                            );
                          }
                          return null;
                        })}

                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 dark:ring-slate-800 dark:hover:bg-slate-800 disabled:opacity-40"
                        >
                          <span className="sr-only">Next</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">
              No racks initialized.
            </div>
          )}
        </div>

        {/* Action Panel Setup */}
        <div className="space-y-6">
          {/* Create rack card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Initialize Rack</h2>
            <form onSubmit={handleAddRack} className="space-y-3">
              <input
                type="text"
                value={newRackName}
                onChange={(e) => setNewRackName(e.target.value)}
                placeholder="e.g. Rack A, Cabinet C"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                required
              />
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Rack
              </button>
            </form>
          </div>

          {/* Add Shelf Drawer selector dialog */}
          {selectedRackId && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/5 p-5 shadow-sm dark:bg-slate-900 dark:border-slate-800/80">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-wider">
                  Add Shelf to {racks?.find(x => x.id === selectedRackId)?.name}
                </h2>
                <button
                  onClick={() => setSelectedRackId(null)}
                  className="text-[10px] text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={handleAddShelf} className="space-y-3">
                <input
                  type="text"
                  value={newShelfName}
                  onChange={(e) => setNewShelfName(e.target.value)}
                  placeholder="e.g. A1, B3"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                  required
                />
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-650 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Append Shelf Location
                </button>
              </form>
            </div>
          )}

          {selectedShelfId && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/5 p-5 shadow-sm dark:bg-slate-900 dark:border-slate-800/80">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-wider">
                  Add Box to Shelf
                </h2>
                <button
                  onClick={() => setSelectedShelfId(null)}
                  className="text-[10px] text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={handleAddBox} className="space-y-3">
                <input
                  type="text"
                  value={newBoxName}
                  onChange={(e) => setNewBoxName(e.target.value)}
                  placeholder="e.g. Box 1, Box 2"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none transition-all focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                  required
                />
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-650 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Append Box Location
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
