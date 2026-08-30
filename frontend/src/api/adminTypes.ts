import type { JobStatus, Plan, TaskPlan } from "./types";

export interface AdminUserItem {
  id: string;
  email: string;
  is_admin: boolean;
  is_suspended: boolean;
  created_at: string;
  job_count: number;
  last_active_at: string | null;
}

export interface AdminUserListResponse {
  users: AdminUserItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface RateLimitBucketState {
  key: string;
  tokens_remaining: number;
  capacity: number;
  period_seconds: number;
}

export interface AdminUserJobSummary {
  id: string;
  user_prompt: string;
  status: JobStatus;
  mode: string;
  groq_tokens_used: number;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserDetailResponse {
  id: string;
  email: string;
  is_admin: boolean;
  is_suspended: boolean;
  created_at: string;
  job_count: number;
  rate_limit_state: RateLimitBucketState;
  jobs: AdminUserJobSummary[];
}

export interface AdminJobListItem {
  id: string;
  user_id: string;
  user_email: string;
  user_prompt: string;
  status: JobStatus;
  mode: string;
  groq_tokens_used: number;
  download_path?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminJobListResponse {
  jobs: AdminJobListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AdminJobDetailResponse {
  id: string;
  user_id: string;
  user_email: string;
  user_prompt: string;
  status: JobStatus;
  mode: string;
  groq_tokens_used: number;
  plan: Plan | null;
  task_plan: TaskPlan | null;
  files_written: Record<string, boolean> | null;
  files_failed: Record<string, string> | null;
  download_path: string | null;
  error_message: string | null;
  files: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface StageFailureCount {
  stage: string;
  count: number;
  percentage: number;
}

export interface RecentFailureItem {
  job_id: string;
  user_id: string;
  user_email: string;
  stage: string;
  error_message: string | null;
  created_at: string;
}

export interface FailureSummaryResponse {
  days: number;
  total_jobs: number;
  total_failures: number;
  failure_rate_percent: number;
  stages: StageFailureCount[];
  recent_failures: RecentFailureItem[];
}

export interface MetricsOverviewResponse {
  jobs_today: number;
  jobs_this_week: number;
  jobs_total: number;
  tokens_today: number;
  tokens_this_week: number;
  tokens_total: number;
  avg_tokens_per_job: number;
  success_rate_percent: number;
  total_completed_jobs: number;
  total_failed_jobs: number;
  total_cancelled_jobs: number;
  total_active_jobs: number;
  total_users: number;
  active_users_this_week: number;
}

export interface TimeseriesPoint {
  date: string;
  job_count: number;
  token_count: number;
  success_count: number;
  failure_count: number;
}

export interface MetricsTimeseriesResponse {
  days: number;
  data: TimeseriesPoint[];
  total_jobs_in_range: number;
  total_tokens_in_range: number;
}

export interface AdminActionResponse {
  ok: boolean;
  message: string;
  user_id?: string;
  job_id?: string;
  is_suspended?: boolean;
  status?: string;
  rate_limit_state?: RateLimitBucketState;
}

export interface AdminAuditLogItem {
  id: string;
  admin_user_id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface AdminAuditLogListResponse {
  logs: AdminAuditLogItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

