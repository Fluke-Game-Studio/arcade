import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";

export type Role =
  | "EMPLOYEE"
  | "ADMIN"
  | "SUPER"
  | "TEST"
  | "ADMIN_READONLY"
  | "SUPER_READONLY";

export type SessionUser = {
  token: string;
  username: string;
  name: string;
  role: Role;
  employee_role?: Role;
  read_only_scope?: Role;
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
  jira_connected?: boolean;
  jira_connected_at?: string;
  jira_account_id?: string;
  jira_email?: string;
  jira_cloud_id?: string;
  jira_cloud_name?: string;
  jira_cloud_url?: string;
  jira_scope?: string;
  password_reset_required?: boolean;
  password_reset_at?: string;
  employee_picture?: string;
  employee_profilepicture?: string;
  onboarding_commitment_required?: boolean;
  notification_preferences?: string | {
    email?: Record<string, boolean>;
    in_app?: Record<string, boolean>;
    discord_dm?: Record<string, boolean>;
    discord_channel?: Record<string, boolean>;
  };
  last_seen_release_version?: string;
  onboarding_journey_state?: string;
};

export type AuthStatus = "checking" | "authenticated" | "unauthenticated";
export type AuthBootReason = "" | "no_token" | "ok" | "invalid_token" | "network";

type AuthCtx = {
  user: SessionUser | null;
  transientPassword: string;
  status: AuthStatus;
  bootReason: AuthBootReason;
  login: (username: string, password: string) => Promise<boolean>;
  refreshSession: () => Promise<void>;
  applySessionPatch: (patch: Partial<SessionUser>) => void;
  clearTransientPassword: () => void;
  logout: () => void;
  // convenient passthroughs
  api: typeof api;
};

const LS_AUTH = "auth_user";
const AuthContext = createContext<AuthCtx | null>(null);

type LowerRole = "employee" | "admin" | "super" | "test";

function normalizeBaseRole(raw: unknown): LowerRole {
  const role = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (role === "test") return "test";
  if (role === "super" || role === "super-readonly") return "super";
  if (role === "admin" || role === "admin-readonly") return "admin";
  return "employee";
}

function normalizeReadScope(raw: unknown): LowerRole {
  return normalizeBaseRole(raw);
}

function toUiRole(role: LowerRole): Role {
  if (role === "test") return "TEST";
  if (role === "super") return "SUPER";
  if (role === "admin") return "ADMIN";
  return "EMPLOYEE";
}

const ROLE_RANK: Record<LowerRole, number> = { test: -1, employee: 0, admin: 1, super: 2 };

function higherRole(base: LowerRole, readScope: LowerRole): LowerRole {
  // Mirrors the backend's getEffectiveRole: only elevate if the read scope's
  // rank is strictly greater than the base role's rank. The old version only
  // ever checked for "admin"/"super" and fell back to "employee" otherwise -
  // which silently promoted every "test" user (base="test", scope="test")
  // back up to "employee", since neither side was "admin" or "super".
  return ROLE_RANK[readScope] > ROLE_RANK[base] ? readScope : base;
}

function buildSessionFromApi(user: any, fallback?: Partial<SessionUser>): SessionUser {
  const baseRole = normalizeBaseRole(user?.employee_role || user?.role || fallback?.employee_role || fallback?.role);
  const readOnlyScope = normalizeReadScope(user?.read_only_scope || fallback?.read_only_scope);
  const effectiveRole = higherRole(baseRole, readOnlyScope);

  return {
    ...(fallback || {}),
    ...(user || {}),
    token: String(user?.token || fallback?.token || ""),
    username: String(user?.username || fallback?.username || ""),
    name: String(user?.name || user?.employee_name || fallback?.name || fallback?.username || ""),
    role: toUiRole(effectiveRole),
    employee_role: toUiRole(baseRole),
    read_only_scope: toUiRole(readOnlyScope),
  } as SessionUser;
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
    const session = buildSessionFromApi(parsed, parsed);
    api.setToken(session.token);
    return session;
  });
  const [transientPassword, setTransientPassword] = useState("");

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
      const res = await api.login(username, password, "portal");
      const session = buildSessionFromApi(res, { token: res.token, username: res.username, name: res.name });
      setSession(session, "authenticated");
      setTransientPassword(password);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  function clearTransientPassword() {
    setTransientPassword("");
  }

  function applySessionPatch(patch: Partial<SessionUser>) {
    if (!user) return;
    const merged = buildSessionFromApi({ ...user, ...patch }, user);
    setSession(merged, "authenticated");
  }

  function logout() {
    clearTransientPassword();
    setSession(null, "unauthenticated");
  }

  async function refreshSession() {
    if (!user?.token) return;

    try {
      const me: any = await api.getMe();
      const refreshed = buildSessionFromApi(me, user);
      setSession(refreshed, "authenticated");
      if (!Boolean((refreshed as any)?.password_reset_required)) {
        clearTransientPassword();
      }
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

        const refreshed = buildSessionFromApi(me, user);

        setSession(refreshed, "authenticated");
        if (!Boolean((refreshed as any)?.password_reset_required)) {
          clearTransientPassword();
        }
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
    () => ({
      user,
      transientPassword,
      status,
      bootReason,
      login,
      refreshSession,
      applySessionPatch,
      clearTransientPassword,
      logout,
      api,
    }),
    [user, transientPassword, status, bootReason, refreshSession]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
