import { useEffect, useState } from "react";
import {
  Activity,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Users,
  TrendingUp,
  RotateCw,
  Flame,
  Calendar,
  Layers,
  DollarSign,
  BarChart2,
  LineChart,
} from "lucide-react";
import { getMetricsOverview, getMetricsTimeseries } from "../../../api/admin";
import type { MetricsOverviewResponse, MetricsTimeseriesResponse, TimeseriesPoint } from "../../../api/adminTypes";
import { useTheme } from "../../../hooks/useTheme";

type MetricView = "jobs" | "tokens" | "status";
type ChartType = "line" | "bar";

export function AdminOverviewPage() {
  const { mode } = useTheme();
  const [overview, setOverview] = useState<MetricsOverviewResponse | null>(null);
  const [timeseries, setTimeseries] = useState<MetricsTimeseriesResponse | null>(null);
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interactive Chart state
  const [metricView, setMetricView] = useState<MetricView>("jobs");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [hoveredPoint, setHoveredPoint] = useState<TimeseriesPoint | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [ovData, tsData] = await Promise.all([
        getMetricsOverview(),
        getMetricsTimeseries(days),
      ]);
      setOverview(ovData);
      setTimeseries(tsData);
    } catch (err: any) {
      setError(err?.message || "Failed to load metrics overview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  const points = timeseries?.data || [];
  const maxJobs = Math.max(...points.map((d) => d.job_count), 1);
  const maxTokens = Math.max(...points.map((d) => d.token_count), 1);
  const totalTokensInRange = timeseries?.total_tokens_in_range || 0;
  const totalJobsInRange = timeseries?.total_jobs_in_range || 0;

  // Estimated Groq cost ($0.59 per 1M tokens approx for Llama 3.3 70B average)
  const estimatedCostTotal = ((overview?.tokens_total || 0) / 1_000_000) * 0.59;
  const estimatedCostToday = ((overview?.tokens_today || 0) / 1_000_000) * 0.59;

  // SVG Line Path Calculation
  const svgWidth = 800;
  const svgHeight = 220;
  const paddingX = 20;
  const paddingY = 20;
  const chartW = svgWidth - paddingX * 2;
  const chartH = svgHeight - paddingY * 2;

  const getCoordinates = () => {
    if (points.length === 0) return [];
    const maxVal = metricView === "tokens" ? maxTokens : maxJobs;
    return points.map((p, i) => {
      const val = metricView === "tokens" ? p.token_count : p.job_count;
      const x = paddingX + (i / Math.max(points.length - 1, 1)) * chartW;
      const y = paddingY + chartH - (val / maxVal) * chartH;
      return { x, y, point: p };
    });
  };

  const coords = getCoordinates();

  const generateSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const mx = (p0.x + p1.x) / 2;
      d += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const linePath = generateSmoothPath(coords);
  const areaPath = coords.length > 0
    ? `${linePath} L ${coords[coords.length - 1].x} ${paddingY + chartH} L ${coords[0].x} ${paddingY + chartH} Z`
    : "";

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Activity className="text-accent" size={22} />
            System Metrics & Usage Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated Groq token consumption, daily job throughput, pipeline health, and infrastructure costs.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center rounded-xl bg-surface border border-border p-1 text-xs">
            {[7, 14, 30, 90].map((d) => (
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
            onClick={fetchData}
            title="Refresh metrics"
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-surfaceRaised hover:text-white transition disabled:opacity-50"
          >
            <RotateCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3.5 text-xs text-danger flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Jobs Today & Volume */}
        <div className="rounded-2xl border border-border/70 bg-surface/70 p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Jobs Today</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              <Layers size={16} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-100 font-mono">
            {overview?.jobs_today ?? 0}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-border/40 pt-2">
            <span>This Week: <strong className="text-slate-200 font-mono">{overview?.jobs_this_week ?? 0}</strong></span>
            <span>All Time: <strong className="text-slate-200 font-mono">{overview?.jobs_total ?? 0}</strong></span>
          </div>
        </div>

        {/* Tokens Today & Total */}
        <div className="rounded-2xl border border-border/70 bg-surface/70 p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tokens Consumed Today</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
              <Zap size={16} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-amber-300 font-mono">
            {overview?.tokens_today !== undefined ? overview.tokens_today.toLocaleString() : "0"}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-border/40 pt-2">
            <span>Avg/Job: <strong className="text-slate-200 font-mono">{overview?.avg_tokens_per_job ?? 0}</strong></span>
            <span>Total: <strong className="text-slate-200 font-mono">{overview?.tokens_total.toLocaleString() ?? 0}</strong></span>
          </div>
        </div>

        {/* Success Rate */}
        <div className="rounded-2xl border border-border/70 bg-surface/70 p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pipeline Success Rate</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-emerald-400 font-mono">
            {overview?.success_rate_percent !== undefined ? `${overview.success_rate_percent}%` : "100%"}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-border/40 pt-2">
            <span>Completed: <strong className="text-success font-mono">{overview?.total_completed_jobs ?? 0}</strong></span>
            <span>Failed: <strong className="text-danger font-mono">{overview?.total_failed_jobs ?? 0}</strong></span>
          </div>
        </div>

        {/* Estimated Groq Spend */}
        <div className="rounded-2xl border border-border/70 bg-surface/70 p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estimated Groq Spend</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-cyan-300 font-mono">
            ${estimatedCostTotal.toFixed(4)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-border/40 pt-2">
            <span>Today: <strong className="text-slate-200 font-mono">${estimatedCostToday.toFixed(4)}</strong></span>
            <span>Users: <strong className="text-slate-200 font-mono">{overview?.total_users ?? 0}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Timeseries Chart Section */}
      <div className="rounded-2xl border border-border/70 bg-surface/70 p-5 shadow-sm space-y-4">
        {/* Chart Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2.5">
            <TrendingUp size={18} className="text-accent" />
            <h2 className="text-sm font-bold text-slate-100">
              Timeseries Analytics ({days} Days)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric Switcher */}
            <div className="flex items-center rounded-xl bg-surfaceRaised/80 border border-border p-1 text-xs">
              <button
                onClick={() => setMetricView("jobs")}
                className={`rounded-lg px-2.5 py-1 font-medium transition ${
                  metricView === "jobs"
                    ? "bg-accent text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Jobs Volume
              </button>
              <button
                onClick={() => setMetricView("tokens")}
                className={`rounded-lg px-2.5 py-1 font-medium transition ${
                  metricView === "tokens"
                    ? "bg-amber-500 text-slate-900 shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Token Usage
              </button>
              <button
                onClick={() => setMetricView("status")}
                className={`rounded-lg px-2.5 py-1 font-medium transition ${
                  metricView === "status"
                    ? "bg-emerald-500 text-slate-900 shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Done vs Failed
              </button>
            </div>

            {/* Chart Type (Line vs Bar) */}
            <div className="flex items-center rounded-xl bg-surfaceRaised/80 border border-border p-1 text-xs">
              <button
                onClick={() => setChartType("line")}
                title="Line chart"
                className={`rounded-lg p-1 transition ${
                  chartType === "line" ? "bg-accent text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <LineChart size={14} />
              </button>
              <button
                onClick={() => setChartType("bar")}
                title="Bar chart"
                className={`rounded-lg p-1 transition ${
                  chartType === "bar" ? "bg-accent text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <BarChart2 size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Selected Hover Tooltip Display */}
        <div className="flex items-center justify-between text-xs bg-surfaceRaised/50 border border-border/40 rounded-xl px-3 py-2">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-mono">
              Date: <strong className="text-slate-200">{hoveredPoint ? hoveredPoint.date : "Hover a data point"}</strong>
            </span>
            {hoveredPoint && (
              <>
                <span className="text-slate-300">
                  Jobs: <strong className="font-mono text-accent">{hoveredPoint.job_count}</strong>
                </span>
                <span className="text-amber-400">
                  Tokens: <strong className="font-mono">{hoveredPoint.token_count.toLocaleString()}</strong>
                </span>
                <span className="text-success">
                  Success: <strong className="font-mono">{hoveredPoint.success_count}</strong>
                </span>
                <span className="text-danger">
                  Failed: <strong className="font-mono">{hoveredPoint.failure_count}</strong>
                </span>
              </>
            )}
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Range Totals: <strong className="text-slate-200">{totalJobsInRange} jobs</strong> •{" "}
            <strong className="text-amber-400">{totalTokensInRange.toLocaleString()} tokens</strong>
          </div>
        </div>

        {/* SVG Line / Area Chart */}
        {chartType === "line" ? (
          <div className="relative w-full h-56 select-none">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="gradient-accent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={metricView === "tokens" ? "#f59e0b" : "#6366f1"} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={metricView === "tokens" ? "#f59e0b" : "#6366f1"} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                 const y = paddingY + chartH * ratio;
                 return (
                   <line
                     key={ratio}
                     x1={paddingX}
                     y1={y}
                     x2={svgWidth - paddingX}
                     y2={y}
                     stroke={mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}
                     strokeDasharray="4 4"
                   />
                 );
               })}

              {/* Filled Area */}
              {areaPath && <path d={areaPath} fill="url(#gradient-accent)" />}

              {/* Primary Curve */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke={metricView === "tokens" ? "#f59e0b" : "#6366f1"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Interactive Points */}
              {coords.map((c, i) => (
                <g key={c.point.date}>
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={hoveredPoint?.date === c.point.date ? 5 : 3}
                    fill={hoveredPoint?.date === c.point.date ? "#ffffff" : metricView === "tokens" ? "#f59e0b" : "#6366f1"}
                    stroke={mode === "dark" ? "#0a0c10" : "#ffffff"}
                    strokeWidth="1.5"
                    className="transition-all cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(c.point)}
                  />
                </g>
              ))}
            </svg>
          </div>
        ) : (
          /* High-Density Bar Chart */
          <div className="h-56 w-full flex items-end gap-1 sm:gap-1.5 pt-4 pb-2">
            {points.map((point) => {
              const maxVal = metricView === "tokens" ? maxTokens : maxJobs;
              const val = metricView === "tokens" ? point.token_count : point.job_count;
              const heightPercent = Math.max(Math.round((val / maxVal) * 100), val > 0 ? 8 : 2);
              const failPercent = point.job_count > 0 ? (point.failure_count / point.job_count) * 100 : 0;

              return (
                <div
                  key={point.date}
                  onMouseEnter={() => setHoveredPoint(point)}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative"
                >
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[20px] rounded-t-md transition-all relative overflow-hidden ${
                      hoveredPoint?.date === point.date
                        ? "bg-white shadow-lg"
                        : metricView === "tokens"
                        ? "bg-amber-500/80 hover:bg-amber-500 cursor-pointer"
                        : "bg-accent/80 hover:bg-accent cursor-pointer"
                    }`}
                  >
                    {metricView === "status" && failPercent > 0 && (
                      <div
                        style={{ height: `${failPercent}%` }}
                        className="absolute top-0 inset-x-0 bg-danger/90"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* X Axis Range Labels */}
        <div className="flex justify-between text-[10px] text-slate-500 font-mono border-t border-border/40 pt-2">
          <span>{points[0]?.date}</span>
          <span>{points[Math.floor(points.length / 2)]?.date}</span>
          <span>{points[points.length - 1]?.date}</span>
        </div>
      </div>
    </div>
  );
}
