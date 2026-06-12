"use client";

import React, { useEffect, useState } from "react";
import { Menu, Sun, Moon, Bell, Search, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface NavbarProps {
  toggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ toggleSidebar }) => {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState<boolean>(true);

  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <header className="fixed top-0 right-0 left-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white/85 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      {/* Left section: mobile hamburger toggle & logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-between rounded-lg bg-emerald-600 text-white">
            <span className="w-full text-center font-bold text-lg leading-none">M</span>
          </div>
          <span className="hidden font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:block">
            MedStore <span className="text-emerald-500">Pro</span>
          </span>
        </div>
      </div>

      {/* Middle section: catalog search input */}
      <div className="hidden max-w-md flex-1 px-4 md:block">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search medicine catalog..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-4 pl-10 text-sm outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:focus:bg-slate-950"
          />
        </div>
      </div>

      {/* Right section: theme switcher, alerts, user info */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          title="Toggle color theme"
        >
          {darkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500" />
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

        {/* User badge */}
        {user && (
          <div className="flex items-center gap-2 pl-2">
            <div className="flex h-8 w-8 items-center justify-between rounded-full bg-emerald-100 dark:bg-emerald-950">
              <ShieldCheck className="h-4 w-4 mx-auto text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="hidden text-left lg:block">
              <p className="text-xs font-semibold leading-tight text-slate-900 dark:text-slate-100">
                {user.full_name}
              </p>
              <p className="text-[10px] text-slate-400">
                {user.role.name}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
