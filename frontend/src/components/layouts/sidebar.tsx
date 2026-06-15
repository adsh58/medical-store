"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { 
  LayoutDashboard, Pill, PlusCircle, Package, 
  FileSpreadsheet, UploadCloud, Grid, AlertTriangle, 
  BarChart3, Settings, LogOut, ShieldAlert, Sparkles,
  ShoppingCart, Tag, UserCheck, Users
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const menuItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "POS Sales", href: "/sales", icon: ShoppingCart },
    { name: "AI Assistant", href: "/assistant", icon: Sparkles },
    { name: "Medicines", href: "/medicines", icon: Pill },
    { name: "Add Medicine", href: "/medicines/add", icon: PlusCircle },
    { name: "Categories", href: "/categories", icon: Tag },
    { name: "Doctors", href: "/doctors", icon: UserCheck },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Inventory", href: "/inventory", icon: Package },
    { name: "Purchase Invoices", href: "/purchases", icon: FileSpreadsheet },
    { name: "Upload Invoice", href: "/purchases/upload", icon: UploadCloud },
    { name: "Rack Management", href: "/racks", icon: Grid },
    { name: "Expiry Alerts", href: "/alerts", icon: AlertTriangle },
    { name: "Reports", href: "/reports", icon: BarChart3 },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile background overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`fixed bottom-0 top-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white pt-16 transition-transform dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-6 px-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Medical Store System
            </span>
            {user && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                <ShieldAlert className="h-4 w-4 text-emerald-500" />
                <div className="truncate">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{user.full_name}</p>
                  <p className="text-[10px] text-slate-400">{user.role.name}</p>
                </div>
              </div>
            )}
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    isActive 
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom logout block */}
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition-all hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};
