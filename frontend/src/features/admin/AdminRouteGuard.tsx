import { ShieldAlert, ArrowLeft, Lock } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

interface AdminRouteGuardProps {
  children: React.ReactNode;
  onExitAdmin: () => void;
}

export function AdminRouteGuard({ children, onExitAdmin }: AdminRouteGuardProps) {
  const { isAuthenticated, isAdmin, user } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas p-4 text-slate-200">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surfaceRaised p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Lock size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-100">Authentication Required</h2>
          <p className="mt-2 text-xs text-slate-400">
            You must be logged in with administrator credentials to access this area.
          </p>
          <button
            onClick={onExitAdmin}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-accent/90"
          >
            <ArrowLeft size={14} />
            <span>Go to Login / Workspace</span>
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas p-4 text-slate-200">
        <div className="w-full max-w-md rounded-2xl border border-danger/30 bg-surfaceRaised p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger border border-danger/20">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-100">Access Restricted (403)</h2>
          <p className="mt-2 text-xs text-slate-400">
            Account <strong className="text-slate-200 font-mono">{user?.email}</strong> does not possess administrator privileges.
          </p>
          <div className="mt-4 rounded-lg bg-surface/80 p-3 text-[11px] text-slate-400 border border-border">
            If you need admin permissions, run the server seeding utility or contact system support.
          </div>
          <button
            onClick={onExitAdmin}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-surfaceRaised border border-border px-4 py-2.5 text-xs font-semibold text-slate-200 hover:text-white hover:border-slate-500 transition"
          >
            <ArrowLeft size={14} />
            <span>Return to Coding Assistant</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
