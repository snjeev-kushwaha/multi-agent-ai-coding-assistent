import { apiFetch } from "./client";
import type {
  AdminActionResponse,
  AdminAuditLogItem,
  AdminAuditLogListResponse,
  AdminJobDetailResponse,
  AdminJobListResponse,
  AdminUserDetailResponse,
  AdminUserListResponse,
  FailureSummaryResponse,
  MetricsOverviewResponse,
  MetricsTimeseriesResponse,
} from "./adminTypes";


export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  is_suspended?: boolean;
  is_admin?: boolean;
}

export interface ListJobsParams {
  page?: number;
  limit?: number;
  status?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  failed_only?: boolean;
}

// User Management
export async function getAdminStatus(): Promise<{ id: string; email: string; is_admin: boolean; status: string }> {
  return apiFetch("/admin/me");
}

export async function listAdminUsers(params: ListUsersParams = {}): Promise<AdminUserListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);
  if (params.is_suspended !== undefined) query.set("is_suspended", String(params.is_suspended));
  if (params.is_admin !== undefined) query.set("is_admin", String(params.is_admin));

  const qs = query.toString();
  return apiFetch(`/admin/users${qs ? `?${qs}` : ""}`);
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetailResponse> {
  return apiFetch(`/admin/users/${userId}`);
}

export async function suspendUser(userId: string): Promise<AdminActionResponse> {
  return apiFetch(`/admin/users/${userId}/suspend`, { method: "POST" });
}

export async function unsuspendUser(userId: string): Promise<AdminActionResponse> {
  return apiFetch(`/admin/users/${userId}/unsuspend`, { method: "POST" });
}

export async function resetUserRateLimit(userId: string): Promise<AdminActionResponse> {
  return apiFetch(`/admin/users/${userId}/reset-rate-limit`, { method: "POST" });
}

// Job Oversight
export async function listAdminJobs(params: ListJobsParams = {}): Promise<AdminJobListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.status) query.set("status", params.status);
  if (params.user_id) query.set("user_id", params.user_id);
  if (params.date_from) query.set("date_from", params.date_from);
  if (params.date_to) query.set("date_to", params.date_to);
  if (params.failed_only !== undefined) query.set("failed_only", String(params.failed_only));

  const qs = query.toString();
  return apiFetch(`/admin/jobs${qs ? `?${qs}` : ""}`);
}

export async function getAdminJobDetail(jobId: string): Promise<AdminJobDetailResponse> {
  return apiFetch(`/admin/jobs/${jobId}`);
}

export async function cancelAdminJob(jobId: string): Promise<AdminActionResponse> {
  return apiFetch(`/admin/jobs/${jobId}/cancel`, { method: "POST" });
}

export async function getFailuresSummary(days = 30): Promise<FailureSummaryResponse> {
  return apiFetch(`/admin/jobs/failures/summary?days=${days}`);
}

// Metrics / Analytics
export async function getMetricsOverview(): Promise<MetricsOverviewResponse> {
  return apiFetch("/admin/metrics/overview");
}

export async function getMetricsTimeseries(days = 30): Promise<MetricsTimeseriesResponse> {
  return apiFetch(`/admin/metrics/timeseries?days=${days}`);
}

// Audit Logs
export interface ListAuditLogsParams {
  page?: number;
  limit?: number;
  action?: string;
  admin_user_id?: string;
  target_type?: string;
  target_id?: string;
}

export async function listAdminAuditLogs(params: ListAuditLogsParams = {}): Promise<AdminAuditLogListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.action) query.set("action", params.action);
  if (params.admin_user_id) query.set("admin_user_id", params.admin_user_id);
  if (params.target_type) query.set("target_type", params.target_type);
  if (params.target_id) query.set("target_id", params.target_id);

  const qs = query.toString();
  return apiFetch(`/admin/audit-logs${qs ? `?${qs}` : ""}`);
}

