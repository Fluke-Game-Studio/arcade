import { createContext, useContext, useMemo, useState } from "react";
import { api } from "../api";

export type Role = "EMPLOYEE" | "ADMIN" | "SUPER";

export type SessionUser = {
  token: string;
  username: string;
  name: string;
  role: Role;
};

type AuthCtx = {
  user: SessionUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  // convenient passthroughs
  api: typeof api;
};

const LS_AUTH = "auth_user";
const AuthContext = createContext<AuthCtx | null>(null);

function mapRole(r: "super" | "admin" | "employee"): Role {
  if (r === "super") return "SUPER";
  if (r === "admin") return "ADMIN";
  return "EMPLOYEE";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => {
    const raw = localStorage.getItem(LS_AUTH);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    api.setToken(parsed.token);
    return parsed;
  });

  async function login(username: string, password: string) {
    try {
      const res = await api.login(username, password);
      const session: SessionUser = {
        token: res.token,
        username: res.username,
        name: res.name,
        role: mapRole(res.role),
      };
      setUser(session);
      localStorage.setItem(LS_AUTH, JSON.stringify(session));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  function logout() {
    setUser(null);
    api.setToken(null);
    localStorage.removeItem(LS_AUTH);
  }

  const value = useMemo(() => ({ user, login, logout, api }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
