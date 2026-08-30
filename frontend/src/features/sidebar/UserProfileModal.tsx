import { useState } from "react";
import { X, User, Mail, Calendar, FolderGit2, LogOut, Copy, Check, Shield } from "lucide-react";
import type { UserProfile } from "../../api/types";

interface UserProfileModalProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onOpenAdmin?: () => void;
}

export function UserProfileModal({ user, isOpen, onClose, onLogout, onOpenAdmin }: UserProfileModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !user) return null;

  const formattedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surfaceRaised p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-accent to-indigo-400 text-base font-bold text-white shadow-md">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-100">Account Details</h2>
                {user.is_admin && (
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent border border-accent/40">
                    ADMIN
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Manage your profile and track stats</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-surface hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Details Grid */}
        <div className="my-5 flex flex-col gap-3">
          {/* Admin quick entry */}
          {user.is_admin && onOpenAdmin && (
            <button
              onClick={() => {
                onClose();
                onOpenAdmin();
              }}
              className="flex items-center justify-between rounded-xl bg-accent/20 border border-accent/40 p-3.5 text-xs font-semibold text-accent hover:bg-accent/30 transition shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <Shield size={16} />
                <span>Launch Admin Control Console</span>
              </div>
              <span className="text-[11px] font-mono opacity-80">/admin &rarr;</span>
            </button>
          )}

          {/* Email */}
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface/70 p-3.5">
            <Mail className="text-accent shrink-0" size={18} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Email Address</div>
              <div className="truncate text-sm font-medium text-slate-200">{user.email}</div>
            </div>
          </div>

          {/* User ID */}
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface/70 p-3.5">
            <User className="text-accent shrink-0" size={18} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">User ID</div>
              <div className="truncate font-mono text-xs text-slate-300">{user.id}</div>
            </div>
            <button
              onClick={handleCopyId}
              title="Copy User ID"
              className="flex items-center gap-1 rounded-md bg-surfaceRaised px-2 py-1 text-xs text-slate-300 hover:text-white transition"
            >
              {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          {/* Total Projects Created & Member Since */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-surface/70 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                <FolderGit2 size={14} className="text-accent" />
                <span>Projects</span>
              </div>
              <div className="text-xl font-bold text-slate-100">{user.total_projects}</div>
              <div className="text-[11px] text-slate-400">Created so far</div>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-surface/70 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                <Calendar size={14} className="text-accent" />
                <span>Joined</span>
              </div>
              <div className="text-xs font-semibold text-slate-200">{formattedDate}</div>
              <div className="text-[11px] text-slate-400">Account status active</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border/70 pt-4">
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2 text-xs font-medium text-danger hover:bg-danger/20 transition"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>

          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

