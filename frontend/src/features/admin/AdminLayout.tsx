import { useState } from "react";
import {
  Activity,
  Users,
  Layers,
  AlertTriangle,
  ArrowLeft,
  Shield,
  LogOut,
  Sparkles,
  FileText,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { AdminOverviewPage } from "./pages/AdminOverviewPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminJobsPage } from "./pages/AdminJobsPage";
import { AdminFailuresPage } from "./pages/AdminFailuresPage";
import { AdminAuditLogsPage } from "./pages/AdminAuditLogsPage";

export type AdminTab = "overview" | "users" | "jobs" | "failures" | "audit";

interface AdminLayoutProps {
  onExitAdmin: () => void;
}

export function AdminLayout({ onExitAdmin }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState<AdminTab>("overview");

  const navItems = [
    { id: "overview" as const, label: "Overview & Metrics", icon: Activity },
    { id: "users" as const, label: "User Accounts", icon: Users },
    { id: "jobs" as const, label: "Job Oversight", icon: Layers },
    { id: "failures" as const, label: "Failure Diagnostics", icon: AlertTriangle },
    { id: "audit" as const, label: "Audit Trail", icon: FileText },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-slate-200">
      {/* Admin Sidebar */}
      <aside className="w-64 flex flex-col border-r border-border/70 bg-surface shrink-0 select-none">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white shadow-md">
              <Shield size={18} />
            </div>
            <div>
              <span className="text-xs font-bold tracking-tight text-white block">Admin Console</span>
              <span className="text-[10px] text-accent font-semibold tracking-wider uppercase block">
                Control Plane
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-accent/15 text-white font-semibold border border-accent/30 shadow-sm"
                    : "text-slate-400 hover:bg-surfaceRaised hover:text-slate-200"
                }`}
              >
                <Icon size={16} className={isActive ? "text-accent" : "text-slate-400"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Back to Coding Assistant & User Info */}
        <div className="border-t border-border/60 p-3 bg-surfaceRaised/50 space-y-2">
          <button
            onClick={onExitAdmin}
            className="flex w-full items-center justify-between rounded-xl bg-surfaceRaised/80 border border-border/70 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-surfaceRaised hover:text-white transition group"
          >
            <div className="flex items-center gap-2">
              <ArrowLeft size={14} className="text-slate-400 group-hover:-translate-x-0.5 transition" />
              <span>Back to Workspace</span>
            </div>
            <Sparkles size={13} className="text-accent" />
          </button>

          <div className="flex items-center justify-between pt-1 px-1 text-[11px] text-slate-400">
            <div className="truncate min-w-0 pr-2">
              <span className="font-mono text-slate-300 block truncate">{user?.email}</span>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="text-slate-500 hover:text-danger p-1 rounded transition shrink-0"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border/60 bg-surface px-6 py-3">

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Admin Area /</span>
            <span className="text-xs font-semibold text-slate-200 capitalize">{currentTab}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Postgres
            </span>
          </div>
        </header>

        {/* Active Page Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentTab === "overview" && <AdminOverviewPage />}
          {currentTab === "users" && <AdminUsersPage />}
          {currentTab === "jobs" && <AdminJobsPage />}
          {currentTab === "failures" && <AdminFailuresPage />}
          {currentTab === "audit" && <AdminAuditLogsPage />}
        </div>
      </main>
    </div>
  );
}

