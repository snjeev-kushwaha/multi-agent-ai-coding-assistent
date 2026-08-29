import { create } from "zustand";
import type { InterruptPayload, Job, JobStatus } from "../api/types";

interface JobStore {
  job: Job | null;
  pendingInterrupt: InterruptPayload | null;
  connectionError: string | null;
  setJob: (job: Job) => void;
  patchStatus: (status: JobStatus) => void;
  setInterrupt: (payload: InterruptPayload | null) => void;
  setConnectionError: (message: string | null) => void;
  reset: () => void;
}

export const useJobStore = create<JobStore>((set) => ({
  job: null,
  pendingInterrupt: null,
  connectionError: null,
  setJob: (job) => set({ job }),
  patchStatus: (status) =>
    set((s) => (s.job ? { job: { ...s.job, status } } : s)),
  setInterrupt: (payload) => set({ pendingInterrupt: payload }),
  setConnectionError: (message) => set({ connectionError: message }),
  reset: () => set({ job: null, pendingInterrupt: null, connectionError: null }),
}));
