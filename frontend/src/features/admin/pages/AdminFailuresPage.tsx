import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Flame,
  RotateCw,
  Compass,
  Cpu,
  TerminalSquare,
  ShieldCheck,
  HelpCircle,
  Clock,
  Layers,
} from "lucide-react";
import { getFailuresSummary } from "../../../api/admin";
import type { FailureSummaryResponse } from "../../../api/adminTypes";

export function AdminFailuresPage() {
  const [data, setData] = useState<FailureSummaryResponse | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFailures = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getFailuresSummary(days);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load failure diagnostics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFailures();
  }, [days]);

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case "Planner":
        return <Compass className="text-indigo-400" size={16} />;
      case "Architect":
        return <Cpu className="text-cyan-400" size={16} />;
      case "Coder":
        return <TerminalSquare className="text-amber-400" size={16} />;
      case "Reviewer":
        return <ShieldCheck className="text-purple-400" size={16} />;
      default:
        return <HelpCircle className="text-slate-400" size={16} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <AlertTriangle className="text-amber-400" size={22} />
            Pipeline Failure Diagnostics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Grouped error metrics across Planner, Architect, Coder, and Reviewer agents to guide optimizations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center rounded-xl bg-surface border border-border p-1 text-xs">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-lg px-2.5 py-1 font-medium transition ${
                  days === d
                    ? "bg-accent text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <button
            onClick={fetchFailures}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-surfaceRaised hover:text-white transition disabled:opacity-50"
          >
            <RotateCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3.5 text-xs text-danger">
          {error}
        </div>
      )}

      {/* Stage Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {data?.stages.map((stage) => (
          <div
            key={stage.stage}
            className="rounded-2xl border border-border/70 bg-surface/70 p-4 space-y-2 shadow-sm relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">{stage.stage}</span>
              <div className="p-1.5 rounded-lg bg-surfaceRaised/80 border border-border/40">
                {getStageIcon(stage.stage)}
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-100 font-mono">{stage.count}</div>
            <div className="text-[11px] text-slate-400 font-medium">
              {stage.percentage}% of failures
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                style={{ width: `${stage.percentage}%` }}
                className="bg-amber-400 h-full rounded-full"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Recent Failure Logs */}
      <div className="rounded-2xl border border-border/70 bg-surface/70 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Flame size={16} className="text-danger" />
            Recent Error Traceback ({data?.recent_failures.length ?? 0})
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            Failure Rate: <strong className="text-danger">{data?.failure_rate_percent}%</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-border bg-surfaceRaised/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-3">Job ID</th>
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Failed Stage</th>
                <th className="py-2.5 px-3">Error Snippet</th>
                <th className="py-2.5 px-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono text-[11px]">
              {data?.recent_failures.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                    No pipeline failures recorded in the selected timeframe!
                  </td>
                </tr>
              ) : (
                data?.recent_failures.map((f) => (
                  <tr key={f.job_id} className="hover:bg-surface/90 transition">
                    <td className="py-2.5 px-3 text-accent font-semibold">{f.job_id}</td>
                    <td className="py-2.5 px-3 text-slate-300 font-sans">{f.user_email}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 rounded bg-surfaceRaised px-1.5 py-0.5 text-[10px] text-amber-300 border border-border">
                        {getStageIcon(f.stage)}
                        <span>{f.stage}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-danger max-w-md truncate font-sans">
                      {f.error_message || "Unknown pipeline exception"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(f.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
