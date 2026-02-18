// src/pages/UpdatesContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../auth/AuthContext";
import type { ApiUpdateRow } from "../api";

export type TimeEntry = { date: string; hours: number };

export type UpdateSubmission = {
  id: string;
  userId?: string;
  userName?: string;
  weekStart: string;
  accomplishments: string;
  blockers: string;
  next: string;
  retrospective: {
    worked: string[];
    didnt: string[];
    improve: string[];
  };
  timesheet: TimeEntry[];
  createdAt: string;
};

type UpdatesContextShape = {
  submissions: UpdateSubmission[];
  save: (u: UpdateSubmission) => void;
  byWeek: (weekStart: string) => UpdateSubmission[];
  allWeeks: string[];
  reload: () => Promise<void>;
  loading: boolean;
  error: string | null;
  unauthenticated: boolean;
};

const UpdatesContext = createContext<UpdatesContextShape | null>(null);

/* ---------- Helpers to normalize API rows ---------- */

function normalizeRetrospective(raw: any): {
  worked: string[];
  didnt: string[];
  improve: string[];
} {
  if (!raw) return { worked: [], didnt: [], improve: [] };

  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = {};
    }
  }

  const asList = (v: any): string[] =>
    Array.isArray(v)
      ? v.map((x) => String(x)).filter(Boolean)
      : typeof v === "string"
      ? v
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  return {
    worked: asList(obj.worked ?? obj.workedList),
    didnt: asList(obj.didnt ?? obj.didntList),
    improve: asList(obj.improve ?? obj.improveList),
  };
}

function normalizeTimesheet(raw: any): TimeEntry[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.map((e) => ({
        date: String(e.date),
        hours: Number(e.hours) || 0,
      }));
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw.map((e) => ({
      date: String(e.date),
      hours: Number(e.hours) || 0,
    }));
  }
  return [];
}

function fromApi(row: ApiUpdateRow): UpdateSubmission {
  const retrospective = normalizeRetrospective(row.retrospective);
  const timesheet = normalizeTimesheet(row.timesheet);

  return {
    id: row.id || crypto.randomUUID(),
    userId:
      row.userId ||
      row.employee_id ||
      (row as any).username ||
      "unknown",
    userName:
      row.userName ||
      (row as any).employee_name ||
      row.userId ||
      (row as any).username ||
      "Anonymous",
    weekStart: row.weekStart || (row as any).weekOf || "",
    accomplishments: row.accomplishments || "",
    blockers: row.blockers || "",
    next: row.next || (row as any).nextWeek || "",
    retrospective,
    timesheet,
    createdAt: row.createdAt || new Date().toISOString(),
  };
}

/* ---------- Deduping: one submission per (user, week) ---------- */

function keyOf(u: UpdateSubmission) {
  return `${u.userId || "unknown"}|${u.weekStart || ""}`;
}

function dedupeByUserWeek(items: UpdateSubmission[]): UpdateSubmission[] {
  const map = new Map<string, UpdateSubmission>();
  for (const u of items) {
    const k = keyOf(u);
    const existing = map.get(k);
    // keep newest createdAt per user/week
    if (!existing || existing.createdAt < u.createdAt) {
      map.set(k, u);
    }
  }
  return Array.from(map.values());
}

/* ---------- Provider ---------- */

export const UpdatesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { api, user } = useAuth();

  const [submissions, setSubmissions] = useState<UpdateSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);

  const reload = useCallback(async () => {
    if (!user) {
      setSubmissions([]);
      setError(null);
      setUnauthenticated(true);
      return;
    }

    if (!api.getUpdates) {
      setError("API client missing getUpdates");
      return;
    }

    setLoading(true);
    setUnauthenticated(false);

    try {
      const rows = await api.getUpdates();
      let mapped = (rows || []).map(fromApi);

      mapped = dedupeByUserWeek(mapped);

      mapped.sort((a, b) => {
        if (a.weekStart < b.weekStart) return 1;
        if (a.weekStart > b.weekStart) return -1;
        if (a.createdAt < b.createdAt) return 1;
        if (a.createdAt > b.createdAt) return -1;
        return 0;
      });

      setSubmissions(mapped);
      setError(null);
    } catch (e: any) {
      console.error("Failed to load weekly updates from API", e);
      const msg = e?.message || "";
      if (msg.includes("(401)") || msg.includes("401")) {
        setUnauthenticated(true);
        setError(null);
      } else {
        setUnauthenticated(false);
        setError(e?.message || "Failed to load weekly updates");
      }
    } finally {
      setLoading(false);
    }
  }, [api, user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = (u: UpdateSubmission) => {
    setSubmissions((prev) => {
      const next = [u, ...prev];
      return dedupeByUserWeek(next);
    });
  };

  const byWeek = (weekStart: string) =>
    submissions.filter((s) => s.weekStart === weekStart);

  const allWeeks = useMemo(() => {
    const set = new Set(submissions.map((s) => s.weekStart));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [submissions]);

  return (
    <UpdatesContext.Provider
      value={{
        submissions,
        save,
        byWeek,
        allWeeks,
        reload,
        loading,
        error,
        unauthenticated,
      }}
    >
      {children}
    </UpdatesContext.Provider>
  );
};

export function useUpdates() {
  const ctx = useContext(UpdatesContext);
  if (!ctx) throw new Error("useUpdates must be used within <UpdatesProvider>");
  return ctx;
}

/* ---------- Date helpers ---------- */

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function startOfWeekMonday(d = new Date()): Date {
  const nd = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = nd.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  nd.setUTCDate(nd.getUTCDate() + diff);
  return nd;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}
