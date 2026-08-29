import { useState } from "react";
import { respondToJob } from "../../api/jobs";
import type { InterruptPayload } from "../../api/types";
import { useJobStore } from "../../store/jobStore";

export function ConfirmationModal({ jobId, payload }: { jobId: string; payload: InterruptPayload }) {
  const [instruction, setInstruction] = useState("");
  const [answers, setAnswers] = useState<string[]>(() => (payload.questions ?? []).map(() => ""));
  const [loading, setLoading] = useState(false);
  const setInterrupt = useJobStore((s) => s.setInterrupt);

  async function submit(body: Parameters<typeof respondToJob>[1]) {
    setLoading(true);
    try {
      await respondToJob(jobId, body);
      setInterrupt(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-2xl">
        {payload.type === "clarification_request" && (
          <>
            <h2 className="mb-1 text-base font-semibold">A few quick questions</h2>
            <p className="mb-4 text-sm text-slate-400">{payload.reason}</p>
            <div className="space-y-3">
              {(payload.questions ?? []).map((q, i) => (
                <div key={i}>
                  <label className="mb-1 block text-sm text-slate-300">{q}</label>
                  <input
                    className="w-full rounded-lg border border-border bg-surfaceRaised px-3 py-2 text-sm outline-none focus:border-accent"
                    value={answers[i]}
                    onChange={(e) => {
                      const next = [...answers];
                      next[i] = e.target.value;
                      setAnswers(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <button
              disabled={loading}
              onClick={() => submit({ answers })}
              className="mt-5 w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accentMuted disabled:opacity-50"
            >
              Continue
            </button>
          </>
        )}

        {payload.type === "plan_confirmation" && payload.plan && (
          <>
            <h2 className="mb-1 text-base font-semibold">Review the plan</h2>
            <p className="mb-4 text-sm text-slate-400">{payload.plan.description}</p>

            <Section title="Project">{payload.plan.name}</Section>
            <Section title="Tech stack">
              <div className="flex flex-wrap gap-1.5">
                {payload.plan.tech_stack.map((t) => (
                  <span key={t} className="rounded-full bg-surfaceRaised px-2 py-0.5 text-xs text-slate-300">
                    {t}
                  </span>
                ))}
              </div>
            </Section>
            <Section title="Features">
              <ul className="list-inside list-disc text-sm text-slate-300">
                {payload.plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Section>

            <EditRow
              instruction={instruction}
              setInstruction={setInstruction}
              loading={loading}
              onProceed={() => submit({ action: "proceed" })}
              onEdit={() => submit({ action: "edit", instruction })}
              onCancel={() => submit({ action: "cancel" })}
            />
          </>
        )}

        {payload.type === "architecture_confirmation" && payload.task_plan && (
          <>
            <h2 className="mb-1 text-base font-semibold">Review the file plan</h2>
            <p className="mb-4 text-sm text-slate-400">
              {payload.task_plan.implementation_steps.length} file(s) will be generated, in this order:
            </p>
            <ol className="mb-4 space-y-2 text-sm">
              {payload.task_plan.implementation_steps.map((t, i) => (
                <li key={t.filepath} className="rounded-lg border border-border bg-surfaceRaised p-2">
                  <div className="font-mono text-xs text-accent">
                    {i + 1}. {t.filepath}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{t.task_description}</div>
                </li>
              ))}
            </ol>

            <EditRow
              instruction={instruction}
              setInstruction={setInstruction}
              loading={loading}
              onProceed={() => submit({ action: "proceed" })}
              onEdit={() => submit({ action: "edit", instruction })}
              onCancel={() => submit({ action: "cancel" })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="text-sm text-slate-200">{children}</div>
    </div>
  );
}

function EditRow({
  instruction,
  setInstruction,
  loading,
  onProceed,
  onEdit,
  onCancel,
}: {
  instruction: string;
  setInstruction: (v: string) => void;
  loading: boolean;
  onProceed: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <input
        placeholder="Optional: describe what to change instead of approving"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        className="mb-3 w-full rounded-lg border border-border bg-surfaceRaised px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="flex gap-2">
        <button
          disabled={loading}
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm text-slate-300 hover:bg-surfaceRaised disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          disabled={loading || !instruction.trim()}
          onClick={onEdit}
          className="rounded-lg border border-border px-4 py-2 text-sm text-slate-300 hover:bg-surfaceRaised disabled:opacity-50"
        >
          Request changes
        </button>
        <button
          disabled={loading}
          onClick={onProceed}
          className="ml-auto rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accentMuted disabled:opacity-50"
        >
          Looks good, proceed
        </button>
      </div>
    </>
  );
}
