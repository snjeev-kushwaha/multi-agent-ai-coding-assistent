import { useEffect, useRef } from "react";
import { getJob, jobStreamUrl } from "../api/jobs";
import { streamJobEvents } from "../lib/streaming";
import { useJobStore } from "../store/jobStore";

export function useJobStream(jobId: string | null) {
  const setJob = useJobStore((s) => s.setJob);
  const patchStatus = useJobStore((s) => s.patchStatus);
  const setInterrupt = useJobStore((s) => s.setInterrupt);
  const setConnectionError = useJobStore((s) => s.setConnectionError);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();
    let cancelled = false;

    async function connect() {
      try {
        const job = await getJob(jobId!);
        if (!cancelled) setJob(job);

        await streamJobEvents(
          jobStreamUrl(jobId!),
          (event) => {
            if (event.type === "status") {
              patchStatus(event.status);
              if (event.status !== "awaiting_input") setInterrupt(null);
            } else if (event.type === "interrupt") {
              setInterrupt(event.payload);
            } else if (event.type === "done") {
              patchStatus(event.status);
              getJob(jobId!).then(setJob).catch(() => {});
            } else if (event.type === "error") {
              setConnectionError(event.message);
            }
          },
          controller.signal
        );
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        // Reconnect with backoff -- SSE connections drop on network blips,
        // proxy timeouts, laptop sleep, etc. Don't treat that as job failure.
        retryCountRef.current += 1;
        const backoff = Math.min(1000 * 2 ** retryCountRef.current, 15000);
        setConnectionError(`Reconnecting... (${err instanceof Error ? err.message : "stream error"})`);
        setTimeout(() => {
          if (!cancelled) connect();
        }, backoff);
      }
    }

    connect();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [jobId]);
}
