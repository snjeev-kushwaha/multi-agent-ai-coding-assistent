import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getCurrentUser, login as apiLogin, signup as apiSignup } from "../api/auth";
import { clearTokens, getAccessToken } from "../api/client";
import type { UserProfile } from "../api/types";

interface AuthContextValue {
  isAuthenticated: boolean;
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getAccessToken());
  const [user, setUser] = useState<UserProfile | null>(null);

  async function fetchUser() {
    try {
      const profile = await getCurrentUser();
      setUser(profile);
    } catch {
      // If fetching profile fails (e.g. token expired), reset auth
      setUser(null);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchUser();
    } else {
      setUser(null);
    }
  }, [isAuthenticated]);

  async function login(email: string, password: string) {
    await apiLogin(email, password);
    setIsAuthenticated(true);
    await fetchUser();
  }

  async function signup(email: string, password: string) {
    await apiSignup(email, password);
    setIsAuthenticated(true);
    await fetchUser();
  }

  function logout() {
    clearTokens();
    setIsAuthenticated(false);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, signup, logout, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
