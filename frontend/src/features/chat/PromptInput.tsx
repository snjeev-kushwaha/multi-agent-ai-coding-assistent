import { useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { createJob } from "../../api/jobs";
import { ApiError } from "../../api/client";
import { useJobStore } from "../../store/jobStore";

const EXAMPLES = [
  "Build a calculator web app with add, subtract, multiply and divide buttons.",
  "Build a to-do list app with add, complete, and delete, using local state.",
  "Build a REST API for a book library with CRUD endpoints in FastAPI.",
];

export function PromptInput({ onJobCreated }: { onJobCreated: (jobId: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reset = useJobStore((s) => s.reset);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    reset();
    try {
      const job = await createJob(prompt.trim());
      onJobCreated(job.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start job");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex items-center gap-2 text-slate-300">
        <Sparkles size={20} className="text-accent" />
        <h1 className="text-lg font-semibold">What do you want to build?</h1>
      </div>

      <form onSubmit={handleSubmit} className="mb-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the app you want, e.g. 'Build a calculator web app with add, subtract, multiply and divide buttons.'"
          rows={4}
          className="w-full resize-none rounded-xl border border-border bg-surface p-4 text-sm outline-none focus:border-accent"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:bg-accentMuted disabled:opacity-50"
        >
          {loading ? "Starting..." : "Generate project"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setPrompt(ex)}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-slate-400 transition hover:border-accent hover:text-slate-200"
          >
            {ex.length > 50 ? ex.slice(0, 50) + "..." : ex}
          </button>
        ))}
      </div>
    </div>
  );
}
