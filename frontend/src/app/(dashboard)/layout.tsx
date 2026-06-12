"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "@/components/layouts/sidebar";
import { Navbar } from "@/components/layouts/navbar";
import { ShieldCheck } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Auth Guard redirect check
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-between bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto flex flex-col items-center gap-4 text-center">
          <div className="relative flex h-16 w-16 items-center justify-between rounded-full bg-emerald-100 dark:bg-emerald-950/40">
            <ShieldCheck className="h-8 w-8 mx-auto animate-pulse text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-950 dark:text-slate-50">Checking authentication...</h2>
            <p className="text-xs text-slate-400">Loading store management configuration</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header bar */}
      <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      
      {/* Sidebar bar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main layout contents area */}
      <div className="pt-16 lg:pl-64">
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
