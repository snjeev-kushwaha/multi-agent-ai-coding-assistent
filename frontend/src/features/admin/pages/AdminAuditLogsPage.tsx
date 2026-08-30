import { useEffect, useState } from "react";
import {
  FileText,
  Search,
  Filter,
  Shield,
  RotateCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Ban,
  RotateCcw,
  Layers,
  X,
} from "lucide-react";
import { listAdminAuditLogs } from "../../../api/admin";
import type { AdminAuditLogItem, AdminAuditLogListResponse } from "../../../api/adminTypes";

export function AdminAuditLogsPage() {
  const [data, setData] = useState<AdminAuditLogListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await listAdminAuditLogs({
        page,
        limit: 15,
        action: actionFilter !== "all" ? actionFilter : undefined,
        target_type: targetTypeFilter !== "all" ? targetTypeFilter : undefined,
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, targetTypeFilter]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case "suspend_user":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2.5 py-0.5 text-[10px] font-bold text-danger border border-danger/30">
            <Ban size={10} /> SUSPEND_USER
          </span>
        );
      case "unsuspend_user":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
            UNSUSPEND_USER
          </span>
        );
      case "reset_rate_limit":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
            <RotateCcw size={10} /> RESET_RATE_LIMIT
          </span>
        );
      case "cancel_job":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/30">
            <Layers size={10} /> CANCEL_JOB
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-surfaceRaised px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-border">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <FileText className="text-accent" size={22} />
            Administrative Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable, timestamped audit log of all account suspensions, job cancellations, and rate-limit resets.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-surfaceRaised hover:text-white transition disabled:opacity-50"
        >
          <RotateCw size={13} className={loading ? "animate-spin" : ""} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-accent"
        >
          <option value="all">All Actions</option>
          <option value="suspend_user">suspend_user</option>
          <option value="unsuspend_user">unsuspend_user</option>
          <option value="reset_rate_limit">reset_rate_limit</option>
          <option value="cancel_job">cancel_job</option>
        </select>

        <select
          value={targetTypeFilter}
          onChange={(e) => {
            setTargetTypeFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-accent"
        >
          <option value="all">All Target Types</option>
          <option value="user">User Targets</option>
          <option value="job">Job Targets</option>
        </select>

        <div className="text-xs text-slate-400 font-mono ml-auto">
          Total Logged Events: <strong className="text-slate-200">{data?.total ?? 0}</strong>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-surface/70 shadow-sm">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead>
            <tr className="border-b border-border bg-surfaceRaised/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="py-3 px-4">Admin</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Target Type</th>
              <th className="py-3 px-4">Target ID</th>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4 text-right">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading && !data ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <Loader2 size={20} className="mx-auto mb-2 animate-spin text-accent" />
                  <span>Loading audit trail...</span>
                </td>
              </tr>
            ) : data?.logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <Shield size={24} className="mx-auto mb-2 opacity-50" />
                  <span>No audit log records found.</span>
                </td>
              </tr>
            ) : (
              data?.logs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="hover:bg-surface/90 transition cursor-pointer"
                >
                  <td className="py-3 px-4 font-medium text-slate-200 truncate max-w-[180px]">
                    {log.admin_email}
                  </td>
                  <td className="py-3 px-4">{getActionBadge(log.action)}</td>
                  <td className="py-3 px-4 font-mono uppercase text-[10px] text-slate-400">
                    {log.target_type}
                  </td>
                  <td className="py-3 px-4 font-mono text-[10px] text-slate-400 truncate max-w-[140px]">
                    {log.target_id || "—"}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLog(log);
                      }}
                      className="rounded-lg bg-surfaceRaised border border-border px-2 py-1 text-[11px] text-slate-300 hover:text-white"
                    >
                      JSON
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            Page {data.page} of {data.total_pages} ({data.total} audit logs)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-slate-300 hover:bg-surfaceRaised disabled:opacity-40 transition"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, data.total_pages))}
              disabled={page >= data.total_pages}
              className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-slate-300 hover:bg-surfaceRaised disabled:opacity-40 transition"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* JSON Metadata Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surfaceRaised p-5 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Audit Log Record: {selectedLog.action}</h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  ID: {selectedLog.id} • {new Date(selectedLog.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-slate-200 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-4 max-h-72 overflow-y-auto rounded-xl bg-surfaceRaised border border-border p-3.5 text-xs font-mono text-emerald-700 dark:text-emerald-300 whitespace-pre">
              {JSON.stringify(
                {
                  id: selectedLog.id,
                  admin_user_id: selectedLog.admin_user_id,
                  admin_email: selectedLog.admin_email,
                  action: selectedLog.action,
                  target_type: selectedLog.target_type,
                  target_id: selectedLog.target_id,
                  metadata: selectedLog.metadata,
                  created_at: selectedLog.created_at,
                },
                null,
                2
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-xl bg-surfaceRaised border border-border px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
