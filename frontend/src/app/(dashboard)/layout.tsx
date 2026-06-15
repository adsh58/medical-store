"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "@/components/layouts/sidebar";
import { Navbar } from "@/components/layouts/navbar";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import Link from "next/link";

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

  const pathname = usePathname();
  const isDoctor = user?.role?.name?.toUpperCase() === "DOCTOR";
  const isAllowedPathForDoctor = ["/", "/assistant", "/settings"].includes(pathname);

  if (isDoctor && !isAllowedPathForDoctor) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        <div className="pt-16 lg:pl-64">
          <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-6 text-center text-rose-650 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-400 max-w-xl mx-auto mt-12">
              <ShieldAlert className="mx-auto h-12 w-12 text-rose-500 mb-3" />
              <h3 className="text-lg font-bold text-rose-600 dark:text-rose-455">Access Denied</h3>
              <p className="text-sm mt-1 mb-4 text-slate-700 dark:text-slate-300">
                Dr. {user?.full_name}, your account role (DOCTOR) is restricted from accessing general store medical records or inventory metrics.
              </p>
              <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-500 transition-colors">
                Back to Personal Portal
              </Link>
            </div>
          </main>
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
