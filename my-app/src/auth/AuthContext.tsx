import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";

export type Role = "EMPLOYEE" | "ADMIN" | "SUPER";

export type SessionUser = {
  token: string;
  username: string;
  name: string;
  role: Role;
  linkedin_connected?: boolean;
  linkedin_connected_at?: string;
  linkedin_member_id?: string;
  linkedin_name?: string;
  linkedin_email?: string;
  linkedin_url?: string;
  discord_connected?: boolean;
  discord_connected_at?: string;
  discord_member_id?: string;
  discord_name?: string;
  discord_email?: string;
  discord_url?: string;
  employee_picture?: string;
  employee_profilepicture?: string;
};

export type AuthStatus = "checking" | "authenticated" | "unauthenticated";
export type AuthBootReason = "" | "no_token" | "ok" | "invalid_token" | "network";

type AuthCtx = {
  user: SessionUser | null;
  status: AuthStatus;
  bootReason: AuthBootReason;
  login: (username: string, password: string) => Promise<boolean>;
  refreshSession: () => Promise<void>;
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
  const hadStoredToken = (() => {
    try {
      const raw = localStorage.getItem(LS_AUTH);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SessionUser;
      return !!String(parsed?.token || "").trim();
    } catch {
      return false;
    }
  })();

  const [user, setUser] = useState<SessionUser | null>(() => {
    const raw = localStorage.getItem(LS_AUTH);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    api.setToken(parsed.token);
    return parsed;
  });

  const [status, setStatus] = useState<AuthStatus>(() => (user ? "checking" : "unauthenticated"));
  const [bootReason, setBootReason] = useState<AuthBootReason>(() =>
    hadStoredToken ? "" : "no_token"
  );

  function setSession(next: SessionUser | null, nextStatus: AuthStatus) {
    setUser(next);
    setStatus(nextStatus);

    if (next) {
      api.setToken(next.token);
      localStorage.setItem(LS_AUTH, JSON.stringify(next));
    } else {
      api.setToken(null);
      localStorage.removeItem(LS_AUTH);
    }
  }

  async function login(username: string, password: string) {
    try {
      const res = await api.login(username, password);
      const session: SessionUser = {
        token: res.token,
        username: res.username,
        name: res.name,
        role: mapRole(res.role),
      };
      setSession(session, "authenticated");
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  function logout() {
    setSession(null, "unauthenticated");
  }

  async function refreshSession() {
    if (!user?.token) return;

    try {
      const me: any = await api.getMe();
      const refreshed: SessionUser = {
        token: user.token,
        username: String(me?.username || user.username),
        name: String(me?.employee_name || me?.name || user.name),
        role: mapRole(String(me?.employee_role || me?.role || "employee").toLowerCase() as any),
        ...(me || {}),
      } as SessionUser;
      setSession(refreshed, "authenticated");
    } catch {}
  }

  useEffect(() => {
    let cancelled = false;

    async function validateToken() {
      if (!user?.token) {
        if (!cancelled) {
          setStatus("unauthenticated");
          setBootReason("no_token");
        }
        return;
      }

      if (!cancelled) {
        setStatus("checking");
        setBootReason("");
      }

      try {
        const me: any = await api.getMe();
        if (cancelled) return;

        const refreshed: SessionUser = {
          token: user.token,
          username: String(me?.username || user.username),
          name: String(me?.employee_name || me?.name || user.name),
          role: mapRole(String(me?.employee_role || me?.role || "employee").toLowerCase() as any),
        };

        setSession(refreshed, "authenticated");
        setBootReason("ok");
      } catch (e: any) {
        if (cancelled) return;
        const msg = String(e?.message || e || "");
        const looksAuthError =
          msg.includes("(401)") || msg.includes("(403)") || msg.includes(" 401") || msg.includes(" 403");

        if (looksAuthError) {
          setSession(null, "unauthenticated");
          setBootReason("invalid_token");
          return;
        }

        // If backend is temporarily unreachable, do not attempt to open protected routes.
        // Treat as unauthenticated so the user sees the login form cleanly.
        setSession(null, "unauthenticated");
        setBootReason("network");
      }
    }

    void validateToken();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

  const value = useMemo(
    () => ({ user, status, bootReason, login, refreshSession, logout, api }),
    [user, status, bootReason, refreshSession]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
