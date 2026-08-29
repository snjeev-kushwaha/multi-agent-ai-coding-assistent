import { CheckCircle2, CircleDot, Loader2, XCircle } from "lucide-react";
import type { Job, JobStatus } from "../../api/types";

const STAGES: { key: string; label: string; statuses: JobStatus[] }[] = [
  { key: "clarify", label: "Understanding request", statuses: ["clarifying", "awaiting_clarification"] },
  { key: "plan", label: "Planning", statuses: ["planning", "awaiting_plan_confirmation"] },
  { key: "architect", label: "Architecting files", statuses: ["architecting", "awaiting_architecture_confirmation"] },
  { key: "code", label: "Writing code", statuses: ["coding", "reviewing", "awaiting_input"] },
  { key: "package", label: "Packaging project", statuses: ["packaging"] },
  { key: "done", label: "Done", statuses: ["done"] },
];

function stageIndex(status: JobStatus | undefined): number {
  if (!status) return -1;
  if (status === "failed" || status === "cancelled") return -1;
  return STAGES.findIndex((s) => s.statuses.includes(status));
}

export function AgentTimeline({ job }: { job: Job | null }) {
  const currentIdx = stageIndex(job?.status);
  const isFailed = job?.status === "failed";
  const isCancelled = job?.status === "cancelled";

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Agent progress
      </h2>
      <ol className="space-y-2">
        {STAGES.map((stage, idx) => {
          const isDone = currentIdx > idx || (currentIdx === idx && stage.key === "done");
          const isCurrent = currentIdx === idx && stage.key !== "done";
          return (
            <li key={stage.key} className="flex items-center gap-2 text-sm">
              {isDone ? (
                <CheckCircle2 size={16} className="text-success shrink-0" />
              ) : isCurrent ? (
                <Loader2 size={16} className="shrink-0 animate-spin text-accent" />
              ) : (
                <CircleDot size={16} className="shrink-0 text-slate-600" />
              )}
              <span className={isDone || isCurrent ? "text-slate-200" : "text-slate-500"}>
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>

      {(isFailed || isCancelled) && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2 text-xs text-danger">
          <XCircle size={14} className="mt-0.5 shrink-0" />
          <span>
            {isCancelled ? "Job cancelled." : job?.error_message ?? "Job failed."}
          </span>
        </div>
      )}
    </div>
  );
}
