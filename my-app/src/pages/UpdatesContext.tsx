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
import type { ApiUpdateRow, ApiUpdateSummary } from "../api";

export type TimeEntry = { date: string; hours: number };

export type UpdateSubmission = {
  id: string;
  userId?: string;
  userName?: string;
  employee_id?: string;
  employee_manager?: string;
  projectId?: string;
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

export type UpdateSummaryView = {
  userId?: string;
  userName?: string;
  employee_id?: string;
  employee_manager?: string;
  projectId?: string;
  weekStart: string;
  createdAtFirst?: string;
  createdAtLast?: string;
  totalEntries: number;
  totalHours: number;
  accomplishments: string[];
  blockers: string[];
  next: string[];
  retrospective: {
    worked: string[];
    didnt: string[];
    improve: string[];
  };
  timesheet: TimeEntry[];
};

type UpdatesContextShape = {
  submissions: UpdateSubmission[];
  summaries: UpdateSummaryView[];
  save: (u: UpdateSubmission) => void;
  byWeek: (weekStart: string) => UpdateSubmission[];
  summariesByWeek: (weekStart: string) => UpdateSummaryView[];
  allWeeks: string[];
  reload: () => Promise<void>;
  loading: boolean;
  error: string | null;
  unauthenticated: boolean;
};

const UpdatesContext = createContext<UpdatesContextShape | null>(null);

/* ---------- helpers ---------- */

function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function safeStr(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

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
      ? v.map((x) => String(x).trim()).filter(Boolean)
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
        date: safeStr(e?.date),
        hours: Number(e?.hours) || 0,
      }));
    } catch {
      return [];
    }
  }

  if (Array.isArray(raw)) {
    return raw.map((e) => ({
      date: safeStr(e?.date),
      hours: Number(e?.hours) || 0,
    }));
  }

  return [];
}

function fromApiRow(row: ApiUpdateRow): UpdateSubmission {
  return {
    id: safeStr(row?.id) || crypto.randomUUID(),
    userId: safeStr(row?.userId || (row as any)?.employee_id || (row as any)?.username),
    userName:
      safeStr(row?.userName || (row as any)?.employee_name) ||
      safeStr(row?.userId || (row as any)?.username) ||
      "Anonymous",
    employee_id: safeStr((row as any)?.employee_id),
    employee_manager: safeStr((row as any)?.employee_manager),
    projectId: safeStr(row?.projectId || (row as any)?.project_id),
    weekStart: safeStr(row?.weekStart || (row as any)?.weekOf),
    accomplishments: safeStr(row?.accomplishments),
    blockers: safeStr(row?.blockers),
    next: safeStr(row?.next || (row as any)?.nextWeek),
    retrospective: normalizeRetrospective(row?.retrospective),
    timesheet: normalizeTimesheet(row?.timesheet),
    createdAt: safeStr(row?.createdAt) || new Date().toISOString(),
  };
}

function fromApiSummary(row: ApiUpdateSummary): UpdateSummaryView {
  return {
    userId: safeStr(row?.userId),
    userName: safeStr(row?.userName) || safeStr((row as any)?.employee_name),
    employee_id: safeStr(row?.employee_id),
    employee_manager: safeStr(row?.employee_manager),
    projectId: safeStr(row?.projectId),
    weekStart: safeStr(row?.weekStart),
    createdAtFirst: safeStr(row?.createdAtFirst),
    createdAtLast: safeStr(row?.createdAtLast),
    totalEntries: Number(row?.totalEntries) || 0,
    totalHours: Number(row?.totalHours) || 0,
    accomplishments: asArray<string>(row?.accomplishments).map(safeStr).filter(Boolean),
    blockers: asArray<string>(row?.blockers).map(safeStr).filter(Boolean),
    next: asArray<string>(row?.next).map(safeStr).filter(Boolean),
    retrospective: normalizeRetrospective(row?.retrospective),
    timesheet: normalizeTimesheet(row?.timesheet),
  };
}

/* ---------- provider ---------- */

export const UpdatesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { api, user } = useAuth();

  const [submissions, setSubmissions] = useState<UpdateSubmission[]>([]);
  const [summaries, setSummaries] = useState<UpdateSummaryView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);

  const reload = useCallback(async () => {
    if (!user) {
      setSubmissions([]);
      setSummaries([]);
      setError(null);
      setUnauthenticated(true);
      return;
    }

    if (!api?.getUpdates) {
      setSubmissions([]);
      setSummaries([]);
      setError("API client missing getUpdates");
      setUnauthenticated(false);
      return;
    }

    setLoading(true);
    setUnauthenticated(false);

    try {
      const payload = await api.getUpdates();

      const rawItems = asArray<ApiUpdateRow>(payload?.items);
      const rawSummaries = asArray<ApiUpdateSummary>(payload?.summaries);

      const mappedItems = rawItems.map(fromApiRow).sort((a, b) => {
        if (a.weekStart < b.weekStart) return 1;
        if (a.weekStart > b.weekStart) return -1;
        if (a.createdAt < b.createdAt) return 1;
        if (a.createdAt > b.createdAt) return -1;
        return 0;
      });

      const mappedSummaries = rawSummaries.map(fromApiSummary).sort((a, b) => {
        if (a.weekStart < b.weekStart) return 1;
        if (a.weekStart > b.weekStart) return -1;
        if ((a.createdAtLast || "") < (b.createdAtLast || "")) return 1;
        if ((a.createdAtLast || "") > (b.createdAtLast || "")) return -1;
        return 0;
      });

      setSubmissions(mappedItems);
      setSummaries(mappedSummaries);
      setError(null);
    } catch (e: any) {
      console.error("Failed to load weekly updates from API", e);
      const msg = safeStr(e?.message);

      setSubmissions([]);
      setSummaries([]);

      if (msg.includes("401") || msg.includes("(401)") || msg.includes("403")) {
        setUnauthenticated(true);
        setError(null);
      } else {
        setUnauthenticated(false);
        setError(msg || "Failed to load weekly updates");
      }
    } finally {
      setLoading(false);
    }
  }, [api, user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = (u: UpdateSubmission) => {
    setSubmissions((prev) => [u, ...asArray(prev)]);
  };

  const byWeek = useCallback(
    (weekStart: string) =>
      asArray(submissions).filter((s) => safeStr(s.weekStart) === safeStr(weekStart)),
    [submissions]
  );

  const summariesByWeek = useCallback(
    (weekStart: string) =>
      asArray(summaries).filter((s) => safeStr(s.weekStart) === safeStr(weekStart)),
    [summaries]
  );

  const allWeeks = useMemo(() => {
    const set = new Set<string>();

    asArray(submissions).forEach((s) => {
      const w = safeStr(s.weekStart);
      if (w) set.add(w);
    });

    asArray(summaries).forEach((s) => {
      const w = safeStr(s.weekStart);
      if (w) set.add(w);
    });

    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [submissions, summaries]);

  return (
    <UpdatesContext.Provider
      value={{
        submissions,
        summaries,
        save,
        byWeek,
        summariesByWeek,
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

/* ---------- date helpers ---------- */

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