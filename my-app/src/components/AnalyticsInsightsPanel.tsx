import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type {
  AnalyticsContributorBreakdownItem,
  AnalyticsDashboardResponse,
  AnalyticsEmployeeLite,
  AnalyticsProjectBreakdownItem,
  AnalyticsUnderReportedItem,
} from "../api/types/analytics";

function safeStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function formatWeekLabel(weekStart?: string) {
  const s = safeStr(weekStart);
  if (!s) return "Current Scope";
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function DonutChart({
  value,
  total,
  label,
  sublabel,
  tone = "blue",
}: {
  value: number;
  total: number;
  label: string;
  sublabel?: string;
  tone?: "blue" | "green" | "amber" | "purple" | "red";
}) {
  const pct = total > 0 ? clamp01(value / total) : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;

  const color =
    tone === "green"
      ? "#22c55e"
      : tone === "amber"
      ? "#f59e0b"
      : tone === "purple"
      ? "#a855f7"
      : tone === "red"
      ? "#ef4444"
      : "#3b82f6";

  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 10, minWidth: 0 }}>
      <div style={{ position: "relative", width: 112, height: 112 }}>
        <svg width="112" height="112" viewBox="0 0 112 112">
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke="rgba(148,163,184,0.18)"
            strokeWidth="12"
          />
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform="rotate(-90 56 56)"
          />
        </svg>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 950, color: "#0f172a", lineHeight: 1 }}>
              {Math.round(pct * 100)}%
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 0.08,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              {value}/{total}
            </div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#102033" }}>{label}</div>
        {!!sublabel && (
          <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniBarChart({
  title,
  items,
  valueKey,
  labelKey,
  color = "linear-gradient(90deg,#60a5fa,#3b82f6)",
  suffix = "",
}: {
  title: string;
  items: Record<string, any>[];
  valueKey: string;
  labelKey: string;
  color?: string;
  suffix?: string;
}) {
  const rows = items.slice(0, 5);
  const max = Math.max(1, ...rows.map((x) => safeNum(x[valueKey])));

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid #e5edf4",
        background: "linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)",
        padding: 14,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a", marginBottom: 12 }}>
        {title}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row, idx) => {
          const raw = safeNum(row[valueKey]);
          const pct = clamp01(raw / max);
          const label = safeStr(row[labelKey]) || `Item ${idx + 1}`;

          return (
            <div key={`${label}-${idx}`} style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 5,
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    color: "#334155",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0,
                  }}
                  title={label}
                >
                  {label}
                </span>
                <span style={{ color: "#64748b", fontWeight: 900, whiteSpace: "nowrap" }}>
                  {raw}
                  {suffix}
                </span>
              </div>

              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(148,163,184,0.15)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(6, pct * 100)}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SnapshotCard({
  label,
  value,
  sublabel,
  tone = "blue",
  onClick,
}: {
  label: string;
  value: number | string;
  sublabel?: string;
  tone?: "blue" | "green" | "amber" | "red" | "slate";
  onClick?: () => void;
}) {
  const toneBg =
    tone === "green"
      ? "rgba(34,197,94,.10)"
      : tone === "amber"
      ? "rgba(245,158,11,.10)"
      : tone === "red"
      ? "rgba(239,68,68,.10)"
      : tone === "slate"
      ? "rgba(100,116,139,.10)"
      : "rgba(59,130,246,.10)";

  const toneBorder =
    tone === "green"
      ? "rgba(34,197,94,.18)"
      : tone === "amber"
      ? "rgba(245,158,11,.18)"
      : tone === "red"
      ? "rgba(239,68,68,.18)"
      : tone === "slate"
      ? "rgba(100,116,139,.18)"
      : "rgba(59,130,246,.18)";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 18,
        border: `1px solid ${toneBorder}`,
        background: `linear-gradient(180deg, ${toneBg}, #fff 76%)`,
        padding: 14,
        boxShadow: "0 10px 22px rgba(15,23,42,.04)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#64748b",
          fontWeight: 900,
          letterSpacing: 0.08,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 28,
          lineHeight: 1,
          fontWeight: 1000,
          color: "#0f172a",
          letterSpacing: -0.03,
        }}
      >
        {value}
      </div>
      {!!sublabel && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "#64748b",
            fontWeight: 700,
            lineHeight: 1.45,
          }}
        >
          {sublabel}
        </div>
      )}
    </button>
  );
}

function DetailList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: Array<AnalyticsEmployeeLite | AnalyticsUnderReportedItem>;
  emptyText: string;
}) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid #e5edf4",
        background: "linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)",
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 950,
          color: "#0f172a",
          marginBottom: 10,
        }}
      >
        {title}
      </div>

      {!items.length ? (
        <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 700 }}>{emptyText}</div>
      ) : (
        <div style={{ display: "grid", gap: 8, maxHeight: 300, overflow: "auto", paddingRight: 4 }}>
          {items.map((item, idx) => {
            const hours =
              typeof (item as AnalyticsUnderReportedItem).totalHours === "number"
                ? (item as AnalyticsUnderReportedItem).totalHours
                : null;
            const missing =
              typeof (item as AnalyticsUnderReportedItem).missingHours === "number"
                ? (item as AnalyticsUnderReportedItem).missingHours
                : null;

            return (
              <div
                key={`${safeStr(item.username)}-${idx}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                  padding: "9px 10px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,.86)",
                  border: "1px solid rgba(226,232,240,.8)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 900,
                      color: "#1e293b",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={item.name || item.username}
                  >
                    {item.name || item.username}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 11,
                      color: "#64748b",
                      fontWeight: 700,
                    }}
                  >
                    {item.department || item.role || item.username}
                  </div>
                </div>

                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {hours !== null && (
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>{hours}h</div>
                  )}
                  {missing !== null && (
                    <div style={{ marginTop: 2, fontSize: 11, fontWeight: 800, color: "#b45309" }}>
                      Missing {missing}h
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailsModal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(2,6,23,.58)",
        display: "grid",
        placeItems: "center",
        padding: 18,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(960px, 100%)",
          maxHeight: "85vh",
          overflow: "hidden",
          borderRadius: 24,
          border: "1px solid rgba(226,232,240,.9)",
          background: "linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)",
          boxShadow: "0 30px 80px rgba(2,6,23,.28)",
        }}
      >
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid #e5edf4",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 1000,
                color: "#0f172a",
                letterSpacing: -0.03,
              }}
            >
              {title}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: "#64748b",
                fontWeight: 700,
              }}
            >
              Detailed employee list
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid #d7e3ee",
              background: "#fff",
              borderRadius: 999,
              width: 38,
              height: 38,
              cursor: "pointer",
              color: "#334155",
              fontWeight: 900,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 18, overflow: "auto", maxHeight: "calc(85vh - 72px)" }}>{children}</div>
      </div>
    </div>
  );
}

export default function AnalyticsInsightsPanel() {
  const { api } = useAuth() as any;
  const [data, setData] = useState<AnalyticsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalKey, setModalKey] = useState<
    null | "missingUpdates" | "missingTimesheets" | "underReportedHours" | "noActivity"
  >(null);

  const apiRef = useRef<any>(api);

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setError("");

        const currentApi = apiRef.current;
        let resp: AnalyticsDashboardResponse | null = null;

        if (currentApi?.analytics?.getDashboard) {
          resp = await currentApi.analytics.getDashboard();
        } else if (typeof currentApi?.getAnalyticsDashboard === "function") {
          resp = await currentApi.getAnalyticsDashboard();
        } else {
          throw new Error("Analytics API is not wired on the client.");
        }

        if (!mounted) return;

        if (!resp || resp.ok !== true) {
          throw new Error("Dashboard response is empty or invalid.");
        }

        setData(resp);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load analytics.");
        setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();

    return () => {
      mounted = false;
    };
  }, []);

  const overview = data?.overview;
  const compliance = data?.compliance;

  const attention = useMemo(() => {
    if (!data) {
      return {
        missingUpdates: [] as AnalyticsEmployeeLite[],
        missingTimesheets: [] as AnalyticsEmployeeLite[],
        underReportedHours: [] as AnalyticsUnderReportedItem[],
        noActivity: [] as AnalyticsEmployeeLite[],
      };
    }

    return {
      missingUpdates: Array.isArray((data as any).attention?.missingUpdates)
        ? (data as any).attention.missingUpdates
        : Array.isArray((data as any).missingUpdates)
        ? (data as any).missingUpdates
        : [],
      missingTimesheets: Array.isArray((data as any).attention?.missingTimesheets)
        ? (data as any).attention.missingTimesheets
        : Array.isArray((data as any).missingTimesheets)
        ? (data as any).missingTimesheets
        : [],
      underReportedHours: Array.isArray((data as any).attention?.underReportedHours)
        ? (data as any).attention.underReportedHours
        : Array.isArray((data as any).underReportedHours)
        ? (data as any).underReportedHours
        : [],
      noActivity: Array.isArray((data as any).attention?.noActivity)
        ? (data as any).attention.noActivity
        : Array.isArray((data as any).noActivity)
        ? (data as any).noActivity
        : [],
    };
  }, [data]);

  const projectItems = useMemo<AnalyticsProjectBreakdownItem[]>(
    () => (Array.isArray(data?.projectBreakdown) ? data.projectBreakdown : []),
    [data]
  );

  const contributorItems = useMemo<AnalyticsContributorBreakdownItem[]>(
    () =>
      (Array.isArray(data?.contributorBreakdown) ? data.contributorBreakdown : []).slice(0, 5),
    [data]
  );

  const modalTitle =
    modalKey === "missingUpdates"
      ? "Employees Missing Weekly Updates"
      : modalKey === "missingTimesheets"
      ? "Employees Missing Timesheets"
      : modalKey === "underReportedHours"
      ? "Employees Under Reported Hours"
      : modalKey === "noActivity"
      ? "Employees With No Activity"
      : "";

  const modalItems =
    modalKey === "missingUpdates"
      ? attention.missingUpdates
      : modalKey === "missingTimesheets"
      ? attention.missingTimesheets
      : modalKey === "underReportedHours"
      ? attention.underReportedHours
      : modalKey === "noActivity"
      ? attention.noActivity
      : [];

  return (
    <>
      <div
        className="card"
        style={{
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 14px 34px rgba(0,0,0,0.08), 0 3px 10px rgba(0,0,0,0.06)",
        }}
      >
        <style>{`
          .aipRoot{
            border:1px solid #e5edf4;
            background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
          }
          .aipHero{
            padding:16px 16px 14px;
            background:
              radial-gradient(900px 280px at 10% 0%, rgba(59,130,246,.18), transparent 55%),
              radial-gradient(700px 240px at 100% 0%, rgba(168,85,247,.14), transparent 55%),
              linear-gradient(135deg, #08111f 0%, #10233a 58%, #173557 100%);
            color:#fff;
            border-bottom:1px solid rgba(255,255,255,.08);
          }
          .aipKicker{
            font-size:11px;
            font-weight:900;
            letter-spacing:.16em;
            text-transform:uppercase;
            color:rgba(191,219,254,.85);
          }
          .aipTitle{
            margin-top:6px;
            font-size:24px;
            font-weight:1000;
            line-height:1.05;
            letter-spacing:-.03em;
          }
          .aipSub{
            margin-top:8px;
            color:rgba(226,232,240,.88);
            font-size:13px;
            line-height:1.55;
            max-width:760px;
          }
          .aipBody{
            padding:16px;
            display:grid;
            gap:16px;
          }
          .aipStats{
            display:grid;
            grid-template-columns:repeat(5,minmax(0,1fr));
            gap:12px;
          }
          .aipGrid2{
            display:grid;
            grid-template-columns:1.05fr .95fr;
            gap:16px;
          }
          .aipGrid3{
            display:grid;
            grid-template-columns:repeat(3,minmax(0,1fr));
            gap:16px;
          }
          .aipEmpty{
            border:1px dashed #d9e5ee;
            border-radius:20px;
            padding:24px 18px;
            text-align:center;
            color:#64748b;
            background:linear-gradient(180deg,#fcfdff 0%,#f8fbfe 100%);
            font-weight:700;
          }
          @media (max-width: 980px){
            .aipStats{ grid-template-columns:repeat(2,minmax(0,1fr)); }
            .aipGrid2{ grid-template-columns:1fr; }
            .aipGrid3{ grid-template-columns:1fr; }
          }
          @media (max-width: 560px){
            .aipStats{ grid-template-columns:1fr; }
          }
        `}</style>

        <div className="aipRoot">
          <div className="aipHero">
            <div className="aipKicker">Analytics</div>
            <div className="aipTitle">Team Analytics Snapshot</div>
            <div className="aipSub">
              Weekly compliance, submission coverage, project effort, and contributor load for{" "}
              {formatWeekLabel(data?.weekStart)}.
            </div>
          </div>

          <div className="aipBody">
            {loading ? (
              <div className="aipEmpty">Loading analytics…</div>
            ) : error ? (
              <div className="aipEmpty">{error}</div>
            ) : !data || !overview || !compliance ? (
              <div className="aipEmpty">No analytics data available.</div>
            ) : (
              <>
                <div className="aipStats">
                  <SnapshotCard
                    label="Team Size"
                    value={safeNum(overview.teamSize)}
                    sublabel="Employees in current scope"
                    tone="slate"
                  />
                  <SnapshotCard
                    label="Contributors"
                    value={safeNum(overview.contributors)}
                    sublabel="Employees with recorded activity"
                    tone="blue"
                  />
                  <SnapshotCard
                    label="Updates"
                    value={safeNum(overview.updatesCount)}
                    sublabel="Weekly updates logged"
                    tone="green"
                  />
                  <SnapshotCard
                    label="Timesheet Rows"
                    value={safeNum(overview.timesheetEntries)}
                    sublabel="Time entries captured"
                    tone="amber"
                  />
                  <SnapshotCard
                    label="Reported Hours"
                    value={safeNum(overview.totalHours)}
                    sublabel="Total hours in this scope"
                    tone="purple"
                  />
                </div>

                <div className="aipStats">
                  <SnapshotCard
                    label="Missing Updates"
                    value={attention.missingUpdates.length}
                    sublabel="Click to inspect employees"
                    tone="blue"
                    onClick={() => setModalKey("missingUpdates")}
                  />
                  <SnapshotCard
                    label="Missing Timesheets"
                    value={attention.missingTimesheets.length}
                    sublabel="Click to inspect employees"
                    tone="amber"
                    onClick={() => setModalKey("missingTimesheets")}
                  />
                  <SnapshotCard
                    label="Under Reported Hours"
                    value={attention.underReportedHours.length}
                    sublabel="Click to inspect employees"
                    tone="red"
                    onClick={() => setModalKey("underReportedHours")}
                  />
                  <SnapshotCard
                    label="No Activity"
                    value={attention.noActivity.length}
                    sublabel="Click to inspect employees"
                    tone="slate"
                    onClick={() => setModalKey("noActivity")}
                  />
                  <SnapshotCard
                    label="Fully Submitted"
                    value={safeNum(compliance.fullySubmitted)}
                    sublabel={`${safeNum(compliance.employees)} employees in scope`}
                    tone="green"
                  />
                </div>

                <div className="aipGrid2">
                  <div
                    style={{
                      borderRadius: 20,
                      border: "1px solid #e5edf4",
                      background: "linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)",
                      padding: 16,
                      boxShadow: "0 10px 22px rgba(15,23,42,.04)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 950,
                        color: "#0f172a",
                        marginBottom: 14,
                      }}
                    >
                      Compliance Overview
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                        gap: 16,
                      }}
                    >
                      <DonutChart
                        value={safeNum(compliance.fullySubmitted)}
                        total={Math.max(1, safeNum(compliance.employees))}
                        label="Fully Submitted"
                        sublabel="Update + timesheet both present"
                        tone="green"
                      />
                      <DonutChart
                        value={safeNum(compliance.submittedUpdates)}
                        total={Math.max(1, safeNum(compliance.employees))}
                        label="Update Coverage"
                        sublabel="Employees who submitted weekly updates"
                        tone="blue"
                      />
                      <DonutChart
                        value={safeNum(compliance.submittedTimesheets)}
                        total={Math.max(1, safeNum(compliance.employees))}
                        label="Timesheet Coverage"
                        sublabel="Employees with weekly timesheets"
                        tone="amber"
                      />
                      <DonutChart
                        value={safeNum(compliance.underReportedHours)}
                        total={Math.max(1, safeNum(compliance.employees))}
                        label="Under Minimum"
                        sublabel="Employees below expected minimum"
                        tone="red"
                      />
                    </div>
                  </div>

                  <MiniBarChart
                    title="Project Breakdown"
                    items={projectItems}
                    valueKey="totalHours"
                    labelKey="projectId"
                    color="linear-gradient(90deg,#34d399,#10b981)"
                    suffix="h"
                  />
                </div>

                <div className="aipGrid2">
                  <MiniBarChart
                    title="Top Contributors"
                    items={contributorItems}
                    valueKey="totalHours"
                    labelKey="name"
                    color="linear-gradient(90deg,#c084fc,#8b5cf6)"
                    suffix="h"
                  />

                  <MiniBarChart
                    title="Updates by Contributor"
                    items={contributorItems}
                    valueKey="updates"
                    labelKey="name"
                    color="linear-gradient(90deg,#60a5fa,#2563eb)"
                  />
                </div>

                <div className="aipGrid2">
                  <MiniBarChart
                    title="Contributors per Project"
                    items={projectItems}
                    valueKey="contributors"
                    labelKey="projectId"
                    color="linear-gradient(90deg,#fbbf24,#f59e0b)"
                  />

                  <MiniBarChart
                    title="Project Updates"
                    items={projectItems}
                    valueKey="updates"
                    labelKey="projectId"
                    color="linear-gradient(90deg,#22c55e,#16a34a)"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <DetailsModal open={!!modalKey} title={modalTitle} onClose={() => setModalKey(null)}>
        <DetailList title={modalTitle} items={modalItems} emptyText="No employees in this category." />
      </DetailsModal>
    </>
  );
}