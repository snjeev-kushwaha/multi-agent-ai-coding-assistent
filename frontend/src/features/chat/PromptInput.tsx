import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Sparkles, Code2, Database, Layout } from "lucide-react";
import { createJob } from "../../api/jobs";
import { ApiError } from "../../api/client";
import { useJobStore } from "../../store/jobStore";

const EXAMPLES = [
  {
    icon: Layout,
    title: "Calculator Web App",
    prompt: "Build a modern calculator web app with addition, subtraction, multiplication, division, and history log.",
  },
  {
    icon: Code2,
    title: "To-Do List App",
    prompt: "Build an interactive to-do list app with categories, priority tags, and local storage persistence.",
  },
  {
    icon: Database,
    title: "NestJS User CRUD API",
    prompt: "Build a NestJS REST API for User management with create, read, update, and delete endpoints.",
  },
];

export function PromptInput({ onJobCreated }: { onJobCreated: (jobId: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reset = useJobStore((s) => s.reset);

  async function submitPrompt() {
    if (!prompt.trim() || loading) return;
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submitPrompt();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitPrompt();
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-3 py-6 sm:px-6">
      {/* Title & Subtitle */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent/30 to-indigo-500/20 text-accent border border-accent/30 shadow-lg shadow-accent/10">
          <Sparkles size={24} />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
          What do you want to build?
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-md">
          Describe any web app, API, or service. Our multi-agent AI will plan, code, and package it for you.
        </p>
      </div>

      {/* ChatGPT-Style Chatbox Form */}
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative rounded-2xl border border-border/80 bg-surface/90 shadow-xl transition focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/40">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI Coding Assistant to build anything... (e.g. 'Build a NestJS User CRUD REST API')"
            rows={3}
            className="w-full resize-none bg-transparent p-4 pb-12 text-sm text-slate-100 placeholder-slate-500 outline-none"
          />

          {/* Action Bar inside Chatbox */}
          <div className="absolute bottom-2.5 right-3 flex items-center gap-2">
            <span className="hidden sm:inline text-[11px] text-slate-500 font-mono">
              Press Enter ↵
            </span>
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              title="Generate Project"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accentMuted disabled:opacity-30 disabled:hover:bg-accent shadow-md"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <ArrowUp size={16} strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>

        {error && <p className="mt-2 text-xs text-danger text-center">{error}</p>}
      </form>

      {/* Example Suggestions */}
      <div className="mt-6 grid w-full grid-cols-1 sm:grid-cols-3 gap-2.5">
        {EXAMPLES.map((ex, i) => {
          const Icon = ex.icon;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setPrompt(ex.prompt)}
              className="group flex flex-col items-start gap-1 rounded-xl border border-border/60 bg-surface/50 p-3 text-left transition hover:border-accent/50 hover:bg-surface hover:shadow-md"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 group-hover:text-accent">
                <Icon size={14} className="text-slate-400 group-hover:text-accent" />
                <span>{ex.title}</span>
              </div>
              <p className="line-clamp-2 text-[11px] text-slate-400">
                {ex.prompt}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
