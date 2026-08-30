import { AlertTriangle, Ban, CheckCircle, Loader2, X } from "lucide-react";
import type { AdminUserItem } from "../../../api/adminTypes";

interface SuspendConfirmModalProps {
  user: AdminUserItem | null;
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function SuspendConfirmModal({
  user,
  isOpen,
  isLoading,
  onClose,
  onConfirm,
}: SuspendConfirmModalProps) {
  if (!isOpen || !user) return null;

  const isSuspending = !user.is_suspended;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surfaceRaised p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-slate-200 transition disabled:opacity-50"
        >
          <X size={18} />
        </button>

        {/* Warning Icon & Header */}
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-inner ${
              isSuspending
                ? "bg-danger/15 text-danger border-danger/30"
                : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            }`}
          >
            {isSuspending ? <Ban size={24} /> : <CheckCircle size={24} />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-100">
              {isSuspending ? "Suspend User Account?" : "Unsuspend User Account?"}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {isSuspending ? (
                <>
                  Are you sure you want to suspend{" "}
                  <strong className="text-slate-200">{user.email}</strong>? The user will immediately be blocked from creating new code generation jobs.
                </>
              ) : (
                <>
                  Are you sure you want to restore access for{" "}
                  <strong className="text-slate-200">{user.email}</strong>? They will be able to resume creating code projects.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-border/60 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-medium text-slate-300 hover:bg-surfaceRaised hover:text-white transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-white transition shadow-md disabled:opacity-50 ${
              isSuspending
                ? "bg-danger hover:bg-danger/90 shadow-danger/20"
                : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : isSuspending ? (
              <>
                <Ban size={14} />
                <span>Suspend Account</span>
              </>
            ) : (
              <>
                <CheckCircle size={14} />
                <span>Unsuspend Account</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
