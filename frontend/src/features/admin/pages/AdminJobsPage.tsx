import { useEffect, useState } from "react";
import {
  Layers,
  Search,
  Filter,
  AlertOctagon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Eye,
  Ban,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Compass,
  Cpu,
  TerminalSquare,
  ShieldCheck,
  RotateCw,
  Zap,
} from "lucide-react";
import {
  cancelAdminJob,
  getAdminJobDetail,
  getFailuresSummary,
  listAdminJobs,
} from "../../../api/admin";
import type {
  AdminJobDetailResponse,
  AdminJobListItem,
  AdminJobListResponse,
  FailureSummaryResponse,
} from "../../../api/adminTypes";
import type { JobStatus } from "../../../api/types";
import { AdminJobDetailDrawer } from "../components/AdminJobDetailDrawer";

export function AdminJobsPage() {
  const [data, setData] = useState<AdminJobListResponse | null>(null);
  const [failureSummary, setFailureSummary] = useState<FailureSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [failedOnly, setFailedOnly] = useState(false);
  const [userIdFilter, setUserIdFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Inspection Drawer State
  const [selectedJob, setSelectedJob] = useState<AdminJobDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchFailureSummary = async () => {
    try {
      const res = await getFailuresSummary(30);
      setFailureSummary(res);
    } catch {
      /* ignore background failure stats error */
    }
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await listAdminJobs({
        page,
        limit: 15,
        status: statusFilter !== "all" ? statusFilter : undefined,
        failed_only: failedOnly ? true : undefined,
        user_id: userIdFilter.trim() || undefined,
        date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
      });
      setData(res);
    } catch (err: any) {
      setBannerMessage({ text: err?.message || "Failed to load jobs list.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFailureSummary();
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [page, statusFilter, failedOnly, dateFrom, dateTo]);

  const handleInspectJob = async (jobId: string) => {
    try {
      setDetailLoading(true);
      const detail = await getAdminJobDetail(jobId);
      setSelectedJob(detail);
    } catch (err: any) {
      setBannerMessage({ text: err?.message || "Failed to load job details.", type: "error" });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!window.confirm(`Are you sure you want to cancel Job ${jobId}?`)) return;
    try {
      setCancellingId(jobId);
      await cancelAdminJob(jobId);
      setBannerMessage({ text: `Job '${jobId}' has been cancelled.`, type: "success" });
      await fetchJobs();
      await fetchFailureSummary();
      if (selectedJob?.id === jobId) {
        setSelectedJob({ ...selectedJob, status: "cancelled" });
      }
    } catch (err: any) {
      setBannerMessage({ text: err?.message || "Failed to cancel job.", type: "error" });
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case "done":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 size={11} /> Done
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-semibold text-danger border border-danger/30">
            <AlertCircle size={11} /> Failed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-border">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent border border-accent/30 animate-pulse">
            <Loader2 size={11} className="animate-spin" /> {status.replace("_", " ")}
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
            <Layers className="text-accent" size={22} />
            Job Oversight & Triage Control
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor pipeline executions, inspect disk code with FileTree & CodeViewer, and cancel stalled jobs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchJobs();
              fetchFailureSummary();
            }}
            title="Refresh jobs"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-surfaceRaised hover:text-white transition"
          >
            <RotateCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {bannerMessage && (
        <div
          className={`flex items-center justify-between rounded-xl p-3 text-xs border ${
            bannerMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-danger/10 border-danger/30 text-danger"
          }`}
        >
          <span>{bannerMessage.text}</span>
          <button onClick={() => setBannerMessage(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Failure-Stage Summary Badge Row */}
      {failureSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 rounded-2xl border border-border/70 bg-surface/60 p-3 shadow-inner">
          {failureSummary.stages.map((st) => (
            <div
              key={st.stage}
              onClick={() => {
                setFailedOnly(true);
                setPage(1);
              }}
              className="flex items-center justify-between rounded-xl bg-surfaceRaised/60 border border-border/50 p-2.5 cursor-pointer hover:border-accent/40 hover:bg-surfaceRaised transition"
            >
              <div className="min-w-0 pr-2">
                <div className="text-[10px] uppercase font-bold text-slate-400 truncate flex items-center gap-1">
                  {st.stage === "Planner" && <Compass size={12} className="text-indigo-400 shrink-0" />}
                  {st.stage === "Architect" && <Cpu size={12} className="text-cyan-400 shrink-0" />}
                  {st.stage === "Coder" && <TerminalSquare size={12} className="text-amber-400 shrink-0" />}
                  {st.stage === "Reviewer" && <ShieldCheck size={12} className="text-purple-400 shrink-0" />}
                  <span>{st.stage}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{st.percentage}% fails</div>
              </div>
              <div className="font-mono text-base font-bold text-slate-200 shrink-0">{st.count}</div>
            </div>
          ))}

          {/* Failure Rate Pill */}
          <div className="flex items-center justify-between rounded-xl bg-danger/10 border border-danger/25 p-2.5">
            <div>
              <div className="text-[10px] uppercase font-bold text-danger">30d Failure Rate</div>
              <div className="text-[10px] text-danger/80 font-mono mt-0.5">
                {failureSummary.total_failures} / {failureSummary.total_jobs} runs
              </div>
            </div>
            <div className="font-mono text-base font-bold text-danger">
              {failureSummary.failure_rate_percent}%
            </div>
          </div>
        </div>
      )}

      {/* Filter and Triage Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface/70 border border-border/70 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-border bg-surfaceRaised px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-accent"
          >
            <option value="all">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="clarifying">Clarifying</option>
            <option value="planning">Planning</option>
            <option value="architecting">Architecting</option>
            <option value="coding">Coding</option>
            <option value="reviewing">Reviewing</option>
            <option value="done">Done</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Failed Only Toggle */}
          <button
            onClick={() => {
              setFailedOnly(!failedOnly);
              setPage(1);
            }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              failedOnly
                ? "bg-danger/20 border-danger/50 text-danger shadow-sm"
                : "bg-surfaceRaised border-border text-slate-400 hover:text-slate-200"
            }`}
          >
            <AlertOctagon size={14} />
            <span>Failed Only</span>
          </button>
        </div>

        {/* Date Range & User Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
            <Calendar size={13} />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-border bg-surfaceRaised px-2 py-1 text-xs text-slate-300 outline-none focus:border-accent"
            />
            <span>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-border bg-surfaceRaised px-2 py-1 text-xs text-slate-300 outline-none focus:border-accent"
            />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              fetchJobs();
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
              placeholder="User ID / Filter..."
              className="rounded-lg border border-border bg-surfaceRaised py-1 px-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-accent font-mono w-36"
            />
            <button
              type="submit"
              className="rounded-lg bg-surfaceRaised border border-border px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white"
            >
              Filter
            </button>
          </form>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-surface/70 shadow-sm">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead>
            <tr className="border-b border-border bg-surfaceRaised/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="py-3 px-4">Job / Prompt</th>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Tokens</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading && !data ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <Loader2 size={20} className="mx-auto mb-2 animate-spin text-accent" />
                  <span>Loading jobs table...</span>
                </td>
              </tr>
            ) : data?.jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <Layers size={24} className="mx-auto mb-2 opacity-50" />
                  <span>No jobs found matching criteria.</span>
                </td>
              </tr>
            ) : (
              data?.jobs.map((job) => {
                const isTerminal = ["done", "failed", "cancelled"].includes(job.status);
                const isBusy = cancellingId === job.id;

                return (
                  <tr
                    key={job.id}
                    onClick={() => handleInspectJob(job.id)}
                    className="hover:bg-surface/90 transition cursor-pointer group"
                  >
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-semibold text-slate-200 group-hover:text-white truncate">
                        {job.user_prompt}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{job.id}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-300 truncate max-w-[160px]">
                        {job.user_email}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{job.user_id}</div>
                    </td>

                    <td className="py-3 px-4">{getStatusBadge(job.status)}</td>

                    <td className="py-3 px-4 font-mono text-amber-400 font-semibold">
                      {job.groq_tokens_used.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(job.created_at).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleInspectJob(job.id)}
                          title="Inspect job plan, tasks, and files"
                          className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-slate-300 hover:bg-surfaceRaised hover:text-white transition"
                        >
                          <Eye size={12} />
                          <span>Inspect</span>
                        </button>

                        {!isTerminal && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            disabled={isBusy}
                            title="Cancel running job"
                            className="flex items-center gap-1 rounded-lg border border-danger/40 bg-danger/10 px-2 py-1 text-xs text-danger hover:bg-danger/20 transition disabled:opacity-50"
                          >
                            <Ban size={12} className={isBusy ? "animate-spin" : ""} />
                            <span>Cancel</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            Page {data.page} of {data.total_pages} ({data.total} jobs)
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

      {/* Job Detail Inspection Drawer */}
      <AdminJobDetailDrawer
        job={selectedJob}
        isOpen={!!selectedJob}
        isCancelling={cancellingId === selectedJob?.id}
        onClose={() => setSelectedJob(null)}
        onCancelJob={handleCancelJob}
      />
    </div>
  );
}
