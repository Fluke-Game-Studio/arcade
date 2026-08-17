import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

const WEEKS_TRACKED = 8;

function mondayISO(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function shortWeekLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type WeekRow = { weekStart: string; filled: boolean; hours: number };

function ComplianceDonut({ filled, total }: { filled: number; total: number }) {
  const pct = total > 0 ? clamp01(filled / total) : 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;
  const color = "#22c55e"; // reuses the app's existing "good/active" green (e.g. status dots elsewhere in Navbar/RightRail)

  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 100, height: 100 }} title={`${filled} of ${total} weeks filled`}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(148,163,184,0.20)" strokeWidth="11" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 950, color: "#0f172a", lineHeight: 1 }}>{Math.round(pct * 100)}%</div>
            <div style={{ marginTop: 2, fontSize: 10, fontWeight: 900, color: "#64748b" }}>
              {filled}/{total}
            </div>
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>Updates Filled</div>
        <div style={{ marginTop: 2, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
          Last {total} weeks — {total - filled} missed
        </div>
      </div>
    </div>
  );
}

function HoursTrend({ rows }: { rows: WeekRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.hours));

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>Weekly Hours</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 64 }}>
        {rows.map((r) => {
          const pct = clamp01(r.hours / max);
          return (
            <div
              key={r.weekStart}
              title={`${shortWeekLabel(r.weekStart)}: ${r.hours.toFixed(1)}h`}
              style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4, minWidth: 0 }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 18,
                  height: Math.max(4, pct * 52),
                  borderRadius: 4,
                  background: r.hours > 0 ? "linear-gradient(180deg,#60a5fa,#3b82f6)" : "rgba(148,163,184,0.20)",
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        {rows.map((r) => (
          <div key={r.weekStart} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#94a3b8", fontWeight: 800, minWidth: 0 }}>
            {shortWeekLabel(r.weekStart).slice(0, 3)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MyActivitySummary() {
  const { api } = useAuth();
  const [rows, setRows] = useState<WeekRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await api.getMyUpdates({ limit: WEEKS_TRACKED + 4 });
        if (!mounted) return;

        const byWeek = new Map<string, { totalHours: number; totalEntries: number }>();
        for (const s of resp?.summaries || []) {
          const week = String((s as any)?.weekStart || "");
          if (!week) continue;
          byWeek.set(week, {
            totalHours: safeNum((s as any)?.totalHours),
            totalEntries: safeNum((s as any)?.totalEntries),
          });
        }

        const thisWeek = mondayISO(new Date());
        const weeks: WeekRow[] = [];
        for (let i = WEEKS_TRACKED - 1; i >= 0; i--) {
          const weekStart = addDays(thisWeek, -7 * i);
          const entry = byWeek.get(weekStart);
          weeks.push({
            weekStart,
            filled: !!entry && entry.totalEntries > 0,
            hours: entry?.totalHours || 0,
          });
        }

        setRows(weeks);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load activity.");
        setRows([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [api]);

  const stats = useMemo(() => {
    const list = rows || [];
    const filled = list.filter((r) => r.filled).length;
    const totalHours = list.reduce((acc, r) => acc + r.hours, 0);
    return { filled, total: list.length, totalHours };
  }, [rows]);

  return (
    <div className="card z-depth-1" style={{ borderRadius: 18, overflow: "hidden" }}>
      <div
        style={{
          padding: 14,
          borderBottom: "1px solid #edf2f7",
          background: "linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%)",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>My Activity</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, fontWeight: 700 }}>
          Updates and hours — last {WEEKS_TRACKED} weeks
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {rows === null ? (
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textAlign: "center", padding: "20px 0" }}>Loading…</div>
        ) : error ? (
          <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 700, textAlign: "center", padding: "20px 0" }}>{error}</div>
        ) : (
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <ComplianceDonut filled={stats.filled} total={stats.total} />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "10px 12px",
                borderRadius: 14,
                background: "rgba(59,130,246,0.06)",
                border: "1px solid rgba(59,130,246,0.14)",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 900, color: "#1d4ed8" }}>Total Time Spent</span>
              <span style={{ fontSize: 18, fontWeight: 950, color: "#0f172a" }}>{stats.totalHours.toFixed(1)}h</span>
            </div>

            <HoursTrend rows={rows} />
          </div>
        )}
      </div>
    </div>
  );
}
