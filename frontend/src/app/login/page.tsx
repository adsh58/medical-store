"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, LogIn, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      router.replace("/");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all credentials fields");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      await login({ email, password });
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-between bg-slate-950 px-4">
      <div className="mx-auto w-full max-w-md">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-between rounded-xl bg-emerald-600 text-white">
            <span className="w-full text-center font-bold text-2xl">M</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">MedStore Pro</h1>
          <p className="mt-1.5 text-xs text-slate-400">Medical Store Management & AI Auditing System</p>
        </div>

        {/* Login form card */}
        <div className="glass-panel rounded-2xl p-6 shadow-xl dark:bg-slate-900/60 dark:border-slate-800">
          <h2 className="mb-5 text-lg font-semibold text-slate-100 flex items-center gap-2">
            <LogIn className="h-5 w-5 text-emerald-500" />
            Security Sign In
          </h2>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-950/35 border border-rose-900/50 p-3 text-xs text-rose-400">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@medicalstore.com"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pr-4 pl-10 text-sm text-slate-200 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Secret Password
              </label>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pr-4 pl-10 text-sm text-slate-200 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Access Dashboard"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
