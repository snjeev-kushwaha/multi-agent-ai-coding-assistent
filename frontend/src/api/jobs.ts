import { apiFetch, getAccessToken } from "./client";
import type { Job } from "./types";

export async function createJob(prompt: string, mode: "build" | "edit" = "build"): Promise<Job> {
  return apiFetch<Job>("/jobs", {
    method: "POST",
    body: JSON.stringify({ prompt, mode }),
  });
}

export async function getJob(jobId: string): Promise<Job> {
  return apiFetch<Job>(`/jobs/${jobId}`);
}

export async function getJobFile(jobId: string, path: string): Promise<{ path: string; content: string }> {
  // Path converter route expects literal slashes -- encode each segment
  // individually rather than the whole path (which would %2F-encode slashes
  // and fail to match the FastAPI {file_path:path} route).
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return apiFetch(`/jobs/${jobId}/files/${encodedPath}`);
}

export async function listJobs(): Promise<Job[]> {
  return apiFetch<Job[]>("/jobs");
}

export async function deleteJob(jobId: string): Promise<void> {
  await apiFetch(`/jobs/${jobId}`, {
    method: "DELETE",
  });
}

export async function respondToJob(
  jobId: string,
  payload: { action?: "proceed" | "edit" | "cancel"; instruction?: string; answers?: string[] }
): Promise<void> {
  await apiFetch(`/jobs/${jobId}/respond`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function downloadJobUrl(jobId: string): string {
  // FileResponse download -- fetched with an auth header via a helper below,
  // since <a href> can't attach an Authorization header.
  return `/api/v1/jobs/${jobId}/download`;
}

export async function downloadJob(jobId: string, filename = "project.zip"): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(downloadJobUrl(jobId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function jobStreamUrl(jobId: string): string {
  return `/api/v1/jobs/${jobId}/stream`;
}
