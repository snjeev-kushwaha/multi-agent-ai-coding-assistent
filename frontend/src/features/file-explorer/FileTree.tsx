import { FileCheck2, FileX2, Loader2 } from "lucide-react";
import type { Job } from "../../api/types";

export function FileTree({
  job,
  selectedPath,
  onSelect,
}: {
  job: Job | null;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const plannedFiles = job?.task_plan?.implementation_steps.map((t) => t.filepath) ?? [];
  const written = new Set(Object.keys(job?.files_written ?? {}));
  const failed = new Set(Object.keys(job?.files_failed ?? {}));

  if (plannedFiles.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-slate-500">
        Files will appear here once the architecture is approved.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-2">
      <h2 className="mb-2 px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Project files
      </h2>
      <ul>
        {plannedFiles.map((path) => {
          const isDone = written.has(path);
          const isFailed = failed.has(path) && !isDone;
          const isPending = !isDone && !isFailed;
          return (
            <li key={path}>
              <button
                onClick={() => isDone && onSelect(path)}
                disabled={!isDone}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                  selectedPath === path ? "bg-accent/20 text-accent" : "text-slate-300 hover:bg-surfaceRaised"
                } ${!isDone ? "cursor-default opacity-60" : ""}`}
              >
                {isDone && <FileCheck2 size={14} className="shrink-0 text-success" />}
                {isFailed && <FileX2 size={14} className="shrink-0 text-danger" />}
                {isPending && <Loader2 size={14} className="shrink-0 animate-spin text-slate-500" />}
                <span className="truncate font-mono text-xs">{path}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
