import { useState } from "react";
import {
  Ban,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  FolderGit2,
  Gauge,
  Layers,
  Loader2,
  Mail,
  RotateCcw,
  Shield,
  User,
  X,
  Zap,
} from "lucide-react";
import type { AdminUserDetailResponse, AdminUserItem } from "../../../api/adminTypes";
import type { JobStatus } from "../../../api/types";

interface UserDetailDrawerProps {
  user: AdminUserDetailResponse | null;
  isOpen: boolean;
  isSelf: boolean;
  onClose: () => void;
  onRequestSuspend: (u: AdminUserItem) => void;
  onResetRateLimit: (u: AdminUserItem) => void;
  onInspectJob?: (jobId: string) => void;
}

export function UserDetailDrawer({
  user,
  isOpen,
  isSelf,
  onClose,
  onRequestSuspend,
  onResetRateLimit,
  onInspectJob,
}: UserDetailDrawerProps) {
  if (!isOpen || !user) return null;

  const asUserItem: AdminUserItem = {
    id: user.id,
    email: user.email,
    is_admin: user.is_admin,
    is_suspended: user.is_suspended,
    created_at: user.created_at,
    job_count: user.job_count,
    last_active_at: user.jobs[0]?.created_at || null,
  };

  const tokensRemaining = user.rate_limit_state?.tokens_remaining ?? 0;
  const capacity = user.rate_limit_state?.capacity || 10;
  const tokenPercent = Math.min(Math.round((tokensRemaining / capacity) * 100), 100);

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case "done":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
            Done
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-danger/15 px-1.5 py-0.5 text-[10px] font-semibold text-danger border border-danger/30">
            Failed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 border border-border">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent border border-accent/30 uppercase">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-surfaceRaised shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 bg-[#0e1117]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-accent to-indigo-400 text-sm font-bold text-white shadow">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">{user.email}</h3>
                {user.is_admin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.2 text-[10px] font-bold text-accent border border-accent/30">
                    <Shield size={10} /> ADMIN
                  </span>
                )}
                {user.is_suspended && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.2 text-[10px] font-bold text-danger border border-danger/30">
                    <Ban size={10} /> SUSPENDED
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{user.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-slate-200 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Rate-Limit Bucket Card */}
          <div className="rounded-xl border border-border/80 bg-surface/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
                <Gauge size={15} className="text-amber-400" />
                <span>Rate-Limit Bucket State</span>
              </div>
              <span className="font-mono text-xs font-bold text-amber-300">
                {tokensRemaining} / {capacity} Tokens
              </span>
            </div>

            {/* Meter Bar */}
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                style={{ width: `${tokenPercent}%` }}
                className={`h-full rounded-full transition-all ${
                  tokenPercent > 30 ? "bg-emerald-400" : "bg-danger"
                }`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Refill Window: 1 Hour ({capacity} jobs max)</span>
              <button
                onClick={() => onResetRateLimit(asUserItem)}
                className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
              >
                <RotateCcw size={12} />
                <span>Reset Bucket</span>
              </button>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface/60 p-3">
            <span className="text-xs text-slate-400 font-medium">Account Controls</span>
            <div className="flex items-center gap-2">
              {!isSelf && (
                <button
                  onClick={() => onRequestSuspend(asUserItem)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition border ${
                    user.is_suspended
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
                      : "bg-danger/15 border-danger/30 text-danger hover:bg-danger/25"
                  }`}
                >
                  <Ban size={13} />
                  <span>{user.is_suspended ? "Unsuspend Account" : "Suspend Account"}</span>
                </button>
              )}
            </div>
          </div>

          {/* User History Table */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FolderGit2 size={14} className="text-accent" />
              Recent Generation History ({user.jobs.length})
            </h4>

            <div className="rounded-xl border border-border/70 bg-surface/60 overflow-hidden">
              {user.jobs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No projects recorded for this user account.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-border/40 text-xs">
                  {user.jobs.map((j) => (
                    <div
                      key={j.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-surface/90 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-200 truncate">{j.user_prompt}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          ID: {j.id} • {new Date(j.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-amber-400">
                          {j.groq_tokens_used.toLocaleString()} tok
                        </span>
                        {getStatusBadge(j.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-3.5 bg-[#0e1117] flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-surfaceRaised border border-border px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
