"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ShieldAlert, Calendar, Filter, RefreshCw, 
  ChevronRight, FileText, X, AlertTriangle, Info, AlertOctagon 
} from "lucide-react";
import apiClient from "@/lib/api-client";

interface SystemLog {
  id: string;
  log_level: string;
  module: string;
  message: string;
  stack_trace: string | null;
  request_path: string | null;
  request_method: string | null;
  user_id: string | null;
  created_at: string;
}

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function SystemLogsPage() {
  const today = getTodayString();
  
  // Filter States (default: ERROR level for current day)
  const [logLevel, setLogLevel] = useState<string>("ERROR");
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  
  // Selected log for detailed modal view
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);

  // Query logs from backend
  const { data: logs, isLoading, refetch, isRefetching } = useQuery<SystemLog[]>({
    queryKey: ["system-logs", logLevel, startDate, endDate],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (logLevel && logLevel !== "ALL") params.log_level = logLevel;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      return apiClient.get("/settings/logs", { params }).then(res => res.data);
    }
  });

  const handleResetFilters = () => {
    setLogLevel("ERROR");
    setStartDate(today);
    setEndDate(today);
  };

  const getLogLevelBadge = (level: string) => {
    switch (level.toUpperCase()) {
      case "ERROR":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
            <AlertOctagon size={12} /> ERROR
          </span>
        );
      case "WARNING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
            <AlertTriangle size={12} /> WARNING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
            <Info size={12} /> INFO
          </span>
        );
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <ShieldAlert className="text-rose-500" /> System Audit Logs
          </h1>
          <p className="text-sm text-slate-500">
            Trace application warnings, API validation failures, and backend unhandled exceptions.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 disabled:opacity-50"
        >
          <RefreshCw size={16} className={isLoading || isRefetching ? "animate-spin" : ""} />
          Reload logs
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          {/* Level Filter */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Filter size={12} /> Log Level
            </label>
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="ERROR">ERROR</option>
              <option value="WARNING">WARNING</option>
              <option value="INFO">INFO</option>
              <option value="ALL">ALL LEVELS</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={12} /> Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            />
          </div>

          {/* End Date */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={12} /> End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            />
          </div>

          {/* Reset Filters */}
          <button
            onClick={handleResetFilters}
            className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 h-[38px] transition-colors"
          >
            Reset defaults
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="text-sm font-medium text-slate-500">Querying database audit logs...</p>
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center text-center p-6">
            <ShieldAlert size={48} className="text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No logs found</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1">
              No warning or error events match the specified date range and log level filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-500 dark:text-slate-400">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Level</th>
                  <th className="px-6 py-3.5">Module</th>
                  <th className="px-6 py-3.5">Message</th>
                  <th className="px-6 py-3.5">Endpoint</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr 
                    key={log.id} 
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-700 dark:text-slate-300">
                      {formatTimestamp(log.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {getLogLevelBadge(log.log_level)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 uppercase tracking-wider">
                        {log.module}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-slate-700 dark:text-slate-300">
                      {log.message}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs">
                      {log.request_method && (
                        <span className={`mr-1 px-1 rounded font-bold ${
                          log.request_method === "POST" ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" :
                          log.request_method === "PUT" ? "text-amber-500 bg-amber-50 dark:bg-amber-950/20" :
                          log.request_method === "DELETE" ? "text-rose-500 bg-rose-50 dark:bg-rose-950/20" :
                          "text-blue-500 bg-blue-50 dark:bg-blue-950/20"
                        }`}>
                          {log.request_method}
                        </span>
                      )}
                      {log.request_path || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="inline-flex items-center gap-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-600 px-2 py-1 text-xs font-semibold border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:border-slate-700/50"
                      >
                        Inspect <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Inspector Modal Dialog */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                {getLogLevelBadge(selectedLog.log_level)}
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded dark:bg-slate-850 dark:text-slate-500">
                  {selectedLog.module} Log Item
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Message */}
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Log Message</h4>
                <p className="text-base font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200/50 dark:border-slate-800/50 whitespace-pre-wrap leading-relaxed">
                  {selectedLog.message}
                </p>
              </div>

              {/* Endpoint Path details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">HTTP Request Path</h4>
                  <div className="rounded-lg bg-slate-50 p-3 font-mono text-sm dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-800/50">
                    <span className="font-bold mr-2 text-slate-400">{selectedLog.request_method || "N/A"}</span>
                    {selectedLog.request_path || "N/A"}
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Log Timestamp</h4>
                  <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-800/50 flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400" />
                    {formatTimestamp(selectedLog.created_at)}
                  </div>
                </div>
              </div>

              {/* User id Context if present */}
              {selectedLog.user_id && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Session Operator ID</h4>
                  <div className="rounded-lg bg-slate-50 p-3 font-mono text-xs dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800/50">
                    {selectedLog.user_id}
                  </div>
                </div>
              )}

              {/* Stack Trace / Exception Details */}
              {selectedLog.stack_trace && (
                <div className="space-y-1 pt-2">
                  <h4 className="text-xs font-semibold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                    <FileText size={12} /> Python traceback stack trace
                  </h4>
                  <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-rose-300 dark:text-rose-400 leading-normal max-h-[250px] border border-rose-950/40">
                    {selectedLog.stack_trace}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-slate-200 p-4 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 text-sm font-semibold dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors"
              >
                Close dialog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
