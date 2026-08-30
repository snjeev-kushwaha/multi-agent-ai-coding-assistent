import { useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  Calendar,
  CheckCircle2,
  Code2,
  Cpu,
  FileCheck2,
  FileCode,
  FileX2,
  FolderGit2,
  Layers,
  Loader2,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import type { AdminJobDetailResponse } from "../../../api/adminTypes";
import type { JobStatus } from "../../../api/types";
import { useTheme } from "../../../hooks/useTheme";

function extensionFor(path: string) {
  if (path.endsWith(".py")) return [python()];
  if (path.endsWith(".json")) return [json()];
  if (path.endsWith(".css")) return [css()];
  if (path.endsWith(".html")) return [html()];
  if (/\.(jsx?|tsx?)$/.test(path)) return [javascript({ jsx: true, typescript: path.endsWith("x") })];
  return [];
}

interface AdminJobDetailDrawerProps {
  job: AdminJobDetailResponse | null;
  isOpen: boolean;
  isCancelling: boolean;
  onClose: () => void;
  onCancelJob: (jobId: string) => void;
}

export function AdminJobDetailDrawer({
  job,
  isOpen,
  isCancelling,
  onClose,
  onCancelJob,
}: AdminJobDetailDrawerProps) {
  const { mode } = useTheme();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    if (job) {
      const filePaths = Object.keys(job.files || {});
      setSelectedPath(filePaths[0] || null);
    } else {
      setSelectedPath(null);
    }
  }, [job]);

  if (!isOpen || !job) return null;

  const isTerminal = ["done", "failed", "cancelled"].includes(job.status);
  const fileKeys = Object.keys(job.files || {});
  const plannedFiles = job.task_plan?.implementation_steps.map((t) => t.filepath) ?? fileKeys;
  const written = new Set(Object.keys(job.files_written || {}));
  const failed = new Set(Object.keys(job.files_failed || {}));

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case "done":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 size={12} /> Done
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-semibold text-danger border border-danger/30">
            <AlertCircle size={12} /> Failed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-surfaceRaised px-2.5 py-0.5 text-xs font-medium text-slate-400 border border-border">
            <Ban size={12} /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent border border-accent/30 animate-pulse">
            <Loader2 size={12} className="animate-spin" /> {status.replace("_", " ")}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-6xl h-[90vh] flex flex-col rounded-2xl border border-border bg-surfaceRaised shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 bg-surface">
          <div className="min-w-0 flex-1 pr-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white shadow shrink-0">
                <Code2 size={16} />
              </div>
              <h3 className="text-sm font-bold text-slate-100 truncate">{job.user_prompt}</h3>
              {getStatusBadge(job.status)}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono mt-1">
              <span>ID: {job.id}</span>
              <span>•</span>
              <span className="text-slate-300">User: {job.user_email}</span>
              <span>•</span>
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <Zap size={11} /> {job.groq_tokens_used.toLocaleString()} tokens
              </span>
              <span>•</span>
              <span>{new Date(job.created_at).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isTerminal && (
              <button
                onClick={() => onCancelJob(job.id)}
                disabled={isCancelling}
                className="flex items-center gap-1.5 rounded-xl border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20 transition disabled:opacity-50"
              >
                {isCancelling ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                <span>Cancel Running Job</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-slate-200 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Layout: 2-Column Split */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[340px_1fr] overflow-hidden min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-border/60">
          {/* Left Column: Metadata & Plan & FileTree */}
          <div className="flex flex-col gap-4 overflow-y-auto p-4 bg-surfaceRaised/40">
            {/* Error Banner */}
            {job.error_message && (
              <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger space-y-1 font-mono">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle size={14} /> Pipeline Error
                </div>
                <div className="break-words text-[11px] opacity-90">{job.error_message}</div>
              </div>
            )}

            {/* Architecture Plan */}
            {job.plan && (
              <div className="rounded-xl border border-border/80 bg-surface/70 p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Cpu size={14} className="text-accent" />
                  <span>Architecture Plan: {job.plan.name}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{job.plan.description}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {job.plan.tech_stack?.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-surfaceRaised px-2 py-0.5 text-[10px] font-medium text-slate-300 border border-border"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* File Tree List */}
            <div className="rounded-xl border border-border/80 bg-surface/70 p-3 flex-1 flex flex-col min-h-48">
              <h4 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Project Files ({fileKeys.length})</span>
                <span className="font-mono text-[10px] text-slate-500">
                  {written.size}/{plannedFiles.length} generated
                </span>
              </h4>

              <div className="flex-1 overflow-y-auto space-y-1">
                {plannedFiles.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No files generated for this job yet.
                  </div>
                ) : (
                  plannedFiles.map((path) => {
                    const hasDiskContent = path in (job.files || {});
                    const isDone = written.has(path) || hasDiskContent;
                    const isFailed = failed.has(path) && !isDone;
                    const isSelected = selectedPath === path;

                    return (
                      <button
                        key={path}
                        onClick={() => setSelectedPath(path)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition font-mono ${
                          isSelected
                            ? "bg-accent/20 text-accent font-semibold border border-accent/40 shadow-sm"
                            : "text-slate-300 hover:bg-surfaceRaised hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isDone ? (
                            <FileCheck2 size={13} className="shrink-0 text-success" />
                          ) : isFailed ? (
                            <FileX2 size={13} className="shrink-0 text-danger" />
                          ) : (
                            <Loader2 size={13} className="shrink-0 animate-spin text-slate-500" />
                          )}
                          <span className="truncate">{path}</span>
                        </div>
                        {hasDiskContent && (
                          <span className="text-[9px] uppercase px-1 rounded bg-surfaceRaised text-slate-500 dark:text-slate-400 border border-border/50 shrink-0">
                            Disk
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: CodeMirror Code Viewer */}
          <div className="flex flex-col overflow-hidden bg-surface">
            <div className="flex items-center justify-between border-b border-border/80 bg-surfaceRaised px-4 py-2 text-xs font-mono text-slate-300">
              <span className="flex items-center gap-2 text-slate-200">
                <FileCode size={14} className="text-accent" />
                <span>{selectedPath || "No file selected"}</span>
              </span>
              {selectedPath && job.files?.[selectedPath] && (
                <span className="text-[11px] text-slate-500">
                  {job.files[selectedPath].split("\n").length} lines
                </span>
              )}
            </div>

            <div className="flex-1 overflow-auto p-1">
              {!selectedPath ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">
                  Select a file from the left panel to inspect code contents.
                </div>
              ) : job.files && job.files[selectedPath] !== undefined ? (
                <CodeMirror
                  value={job.files[selectedPath]}
                  theme={mode === "dark" ? "dark" : "light"}
                  extensions={extensionFor(selectedPath)}
                  editable={false}
                  basicSetup={{ lineNumbers: true, foldGutter: true }}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-xs text-slate-500 gap-2 p-6 text-center">
                  <FileCode size={28} className="opacity-40" />
                  <span>File content not written to disk or pending generation.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
