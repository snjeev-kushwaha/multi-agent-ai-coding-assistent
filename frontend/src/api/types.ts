export interface ProjectFile {
  path: string;
  description: string;
}

export interface Plan {
  name: string;
  description: string;
  tech_stack: string[];
  features: string[];
  files: ProjectFile[];
}

export interface ImplementationTask {
  filepath: string;
  task_description: string;
  depends_on: string[];
}

export interface TaskPlan {
  implementation_steps: ImplementationTask[];
}

export type JobStatus =
  | "queued"
  | "clarifying"
  | "awaiting_clarification"
  | "planning"
  | "awaiting_plan_confirmation"
  | "architecting"
  | "awaiting_architecture_confirmation"
  | "awaiting_input"
  | "coding"
  | "reviewing"
  | "packaging"
  | "done"
  | "failed"
  | "cancelled";

export interface Job {
  id: string;
  status: JobStatus;
  user_prompt: string;
  mode?: "build" | "edit";
  groq_tokens_used?: number;
  plan: Plan | null;
  task_plan: TaskPlan | null;
  files_written: Record<string, boolean> | null;
  files_failed: Record<string, string> | null;
  download_path: string | null;
  error_message: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InterruptPayload {
  type: "clarification_request" | "plan_confirmation" | "architecture_confirmation";
  questions?: string[];
  reason?: string;
  plan?: Plan;
  task_plan?: TaskPlan;
}

export type StreamEvent =
  | { type: "status"; status: JobStatus }
  | { type: "interrupt"; payload: InterruptPayload }
  | { type: "done"; status: JobStatus }
  | { type: "error"; message: string };

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserProfile {
  id: string;
  email: string;
  is_admin?: boolean;
  is_suspended?: boolean;
  created_at: string;
  total_projects: number;
}

