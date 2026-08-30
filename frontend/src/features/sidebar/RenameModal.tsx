import { useEffect, useState } from "react";
import { Edit3, Loader2, X } from "lucide-react";
import type { Job } from "../../api/types";

interface RenameModalProps {
  job: Job | null;
  isOpen: boolean;
  isRenaming: boolean;
  onClose: () => void;
  onConfirm: (newTitle: string) => void;
}

export function RenameModal({
  job,
  isOpen,
  isRenaming,
  onClose,
  onConfirm,
}: RenameModalProps) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (job) {
      setTitle(job.plan?.name || job.user_prompt || "");
      setError(null);
    }
  }, [job, isOpen]);

  if (!isOpen || !job) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Project title cannot be empty");
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surfaceRaised p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isRenaming}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-slate-200 transition disabled:opacity-50"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 mb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/30 shadow-inner">
            <Edit3 size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">Rename Project</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose a clear, descriptive name for this chat and project.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
              placeholder="e.g., Markdown Blog Generator"
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-accent focus:ring-1 focus:ring-accent transition font-medium"
            />
            {error && <p className="text-[11px] text-danger mt-1.5">{error}</p>}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isRenaming}
              className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-medium text-slate-300 hover:bg-surfaceRaised hover:text-white transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRenaming || !title.trim()}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent/90 transition shadow-md shadow-accent/20 disabled:opacity-50"
            >
              {isRenaming ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
