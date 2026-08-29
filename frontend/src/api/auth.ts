import { apiFetch, setTokens } from "./client";
import type { AuthTokens, UserProfile } from "./types";

export async function signup(email: string, password: string): Promise<void> {
  const tokens = await apiFetch<AuthTokens>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setTokens(tokens.access_token, tokens.refresh_token);
}

export async function login(email: string, password: string): Promise<void> {
  const tokens = await apiFetch<AuthTokens>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setTokens(tokens.access_token, tokens.refresh_token);
}

export async function getCurrentUser(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/auth/me");
}
