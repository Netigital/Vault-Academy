"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getBackendBase } from "../../lib/api";

export type UserRole = "student" | "teacher";

export interface UserAccount {
  id?: number;
  username: string;
  role: UserRole;
}

interface AuthContextType {
  user: UserAccount | null;
  sessionToken: string | null;
  loading: boolean;
  login: (username: string, role?: UserRole, sessionToken?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  sessionToken: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Defer storage hydration to avoid synchronous effect updates.
    Promise.resolve().then(() => {
      try {
        const stored = localStorage.getItem("vault_academy_user");
        if (stored) setUser(JSON.parse(stored));
        setSessionToken(localStorage.getItem("vault_academy_session"));
      } catch {
        // Ignore storage errors
      } finally {
        setLoading(false);
      }
    });

    // Failsafe timeout: never allow app to hang in loading state longer than 400ms
    const timer = setTimeout(() => {
      setLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  const login = (username: string, role: UserRole = "student", token?: string) => {
    const acc: UserAccount = { username, role };
    setUser(acc);
    if (token) setSessionToken(token);
    try {
      localStorage.setItem("vault_academy_user", JSON.stringify(acc));
      if (token) localStorage.setItem("vault_academy_session", token);
    } catch {
      // Ignore
    }
  };

  const logout = () => {
    const token = localStorage.getItem("vault_academy_session");
    if (token) {
      fetch(`${getBackendBase()}/api/auth/logout`, {
        method: "POST",
        headers: { "X-Vault-Session": token },
      }).catch(() => {});
    }
    setUser(null);
    setSessionToken(null);
    try {
      localStorage.removeItem("vault_academy_user");
      localStorage.removeItem("vault_academy_session");
    } catch {
      // Ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, sessionToken, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
