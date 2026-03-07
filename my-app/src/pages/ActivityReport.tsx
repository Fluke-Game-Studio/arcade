import { useEffect, useMemo, useState } from "react";
import {
  api,
  type ApiUpdateSummary,
  type ApiUpdatesResponse,
} from "../api";

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function colorForHours(hours: number) {
  if (hours >= 5) {
    return {
      bg: "linear-gradient(135deg, #166534 0%, #15803d 100%)",
      text: "#ecfdf5",
      border: "rgba(22,101,52,.40)",
    };
  }
  if (hours >= 3) {
    return {
      bg: "linear-gradient(135deg, #86efac 0%, #4ade80 100%)",
      text: "#14532d",
      border: "rgba(34,197,94,.35)",
    };
  }
  if (hours >= 1) {
    return {
      bg: "linear-gradient(135deg, #d9f99d 0%, #bef264 100%)",
      text: "#365314",
      border: "rgba(132,204,22,.35)",
    };
  }
  return {
    bg: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
    text: "#64748b",
    border: "rgba(148,163,184,.28)",
  };
}

function MetricChip({
  icon,
  label,
  value,
  tint = "#e2e8f0",
  color = "#0f172a",
}: {
  icon: string;
  label: string;
  value: string;
  tint?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        background: tint,
        color,
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      <i className="material-icons" style={{ fontSize: 16 }}>
        {icon}
      </i>
      <span>{label}</span>
      <span style={{ opacity: 0.9 }}>{value}</span>
    </div>
  );
}

function weekDatesFromMonday(mondayIso: string) {
  const start = new Date(`${mondayIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];

  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);
  }
  return out;
}

function weekdayShort(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function formatDateLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function HeatmapPopover({
  weekStart,
  timesheet,
}: {
  weekStart: string;
  timesheet: { date: string; hours: number }[];
}) {
  const byDate = new Map<string, number>();

  for (const row of timesheet || []) {
    const date = safeStr(row?.date);
    const hours = Number(row?.hours || 0) || 0;
    if (!date) continue;
    byDate.set(date, (byDate.get(date) || 0) + hours);
  }

  const days = weekDatesFromMonday(weekStart);

  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        bottom: "calc(100% + 10px)",
        width: 300,
        zIndex: 9999,
        background: "rgba(255,255,255,.98)",
        border: "1px solid rgba(148,163,184,.18)",
        borderRadius: 16,
        boxShadow: "0 18px 50px rgba(15,23,42,.18)",
        padding: 12,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: "#0f172a",
          marginBottom: 10,
        }}
      >
        Weekly Time Heatmap
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0,1fr))",
          gap: 8,
        }}
      >
        {days.map((date) => {
          const hours = Number(byDate.get(date) || 0);
          const tone = colorForHours(hours);

          return (
            <div
              key={date}
              style={{
                borderRadius: 14,
                border: `1px solid ${tone.border}`,
                background: tone.bg,
                color: tone.text,
                minHeight: 36,
                padding: "4px 2px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 800 }}>{weekdayShort(date)}</div>
              <div style={{ fontSize: 11, fontWeight: 900 }}>
                {hours > 0 ? hours.toFixed(1) : "—"}
              </div>
              <div style={{ fontSize: 9 }}>{formatDateLabel(date)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListPopover({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        bottom: "calc(100% + 10px)",
        width: 320,
        maxWidth: "70vw",
        zIndex: 9999,
        background: "rgba(255,255,255,.98)",
        border: "1px solid rgba(148,163,184,.18)",
        borderRadius: 16,
        boxShadow: "0 18px 50px rgba(15,23,42,.18)",
        padding: 12,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: "#0f172a",
          marginBottom: 10,
        }}
      >
        {title}
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>No items</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item, idx) => (
            <div
              key={`${title}-${idx}`}
              style={{
                fontSize: 12,
                color: "#334155",
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                padding: "8px 10px",
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px solid rgba(148,163,184,.12)",
              }}
            >
              {idx + 1}. {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompactListCell({
  title,
  items,
  cellId,
  hoveredCellId,
  setHoveredCellId,
}: {
  title: string;
  items: string[];
  cellId: string;
  hoveredCellId: string | null;
  setHoveredCellId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const count = items.length;

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setHoveredCellId(cellId)}
      onMouseLeave={() =>
        setHoveredCellId((curr) => (curr === cellId ? null : curr))
      }
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 44,
          padding: "7px 11px",
          borderRadius: 999,
          background: count > 0 ? "rgba(59,130,246,.10)" : "rgba(148,163,184,.10)",
          color: count > 0 ? "#1d4ed8" : "#64748b",
          fontWeight: 900,
          fontSize: 12,
          cursor: "default",
        }}
      >
        {count}
      </span>

      {hoveredCellId === cellId && <ListPopover title={title} items={items} />}
    </div>
  );
}

export default function ActivityReport() {
  const [summaries, setSummaries] = useState<ApiUpdateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [hoveredHoursKey, setHoveredHoursKey] = useState<string | null>(null);
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const resp: ApiUpdatesResponse = await api.getUpdates();
        if (!mounted) return;

        const normalized = Array.isArray(resp?.summaries) ? resp.summaries : [];
        setSummaries(normalized);

        if (normalized.length > 0) {
          const weeks = Array.from(
            new Set(normalized.map((x) => x.weekStart).filter(Boolean))
          ).sort((a, b) => String(b).localeCompare(String(a)));

          setSelectedWeek((prev) => prev || weeks[0] || "");
        }
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || "Failed to load activity report.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const allWeeks = useMemo(() => {
    return Array.from(
      new Set(summaries.map((x) => x.weekStart).filter(Boolean))
    ).sort((a, b) => String(b).localeCompare(String(a)));
  }, [summaries]);

  const rows = useMemo(() => {
    const filtered = selectedWeek
      ? summaries.filter((s) => s.weekStart === selectedWeek)
      : summaries;

    return [...filtered].sort((a, b) => {
      const w = String(b.weekStart || "").localeCompare(String(a.weekStart || ""));
      if (w !== 0) return w;
      return String(a.userName || a.userId || "").localeCompare(
        String(b.userName || b.userId || "")
      );
    });
  }, [summaries, selectedWeek]);

  const totals = useMemo(() => {
    const employees = new Set(rows.map((r) => r.userId || r.userName || "Anon"));
    const totalEntries = rows.reduce((acc, r) => acc + (Number(r.totalEntries) || 0), 0);
    const totalHours = rows.reduce((acc, r) => acc + (Number(r.totalHours) || 0), 0);

    return {
      employees: employees.size,
      totalEntries,
      totalHours,
    };
  }, [rows]);

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div
        className="card"
        style={{
          borderRadius: 24,
          overflow: "visible",
          border: "1px solid rgba(148,163,184,.14)",
          boxShadow: "0 16px 40px rgba(15,23,42,.08)",
          background:
            "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(255,255,255,1) 100%)",
        }}
      >
        <div
          style={{
            padding: 22,
            borderBottom: "1px solid rgba(148,163,184,.12)",
            background:
              "radial-gradient(circle at top right, rgba(34,197,94,.08), transparent 30%), radial-gradient(circle at top left, rgba(59,130,246,.07), transparent 28%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 1000,
                  color: "#0f172a",
                  letterSpacing: "-0.02em",
                }}
              >
                Activity Report
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: "#475569",
                  fontSize: 14,
                  maxWidth: 720,
                }}
              >
                Weekly cumulative employee summaries.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <MetricChip
                icon="groups"
                label="Employees"
                value={String(totals.employees)}
                tint="rgba(59,130,246,.10)"
                color="#1d4ed8"
              />
              <MetricChip
                icon="article"
                label="Entries"
                value={String(totals.totalEntries)}
                tint="rgba(245,158,11,.12)"
                color="#b45309"
              />
              <MetricChip
                icon="schedule"
                label="Hours"
                value={totals.totalHours.toFixed(1)}
                tint="rgba(34,197,94,.12)"
                color="#166534"
              />
            </div>
          </div>

          <div className="row" style={{ marginBottom: 0, marginTop: 14 }}>
            <div className="col s12 m6 l4">
              <div className="input-field" style={{ marginTop: 0 }}>
                <select
                  className="browser-default"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(148,163,184,.25)",
                    background: "#fff",
                    padding: "10px 12px",
                    height: 44,
                  }}
                >
                  <option value="">All weeks</option>
                  {allWeeks.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
                <label
                  className="active"
                  style={{
                    display: "block",
                    position: "static",
                    marginBottom: 6,
                    color: "#475569",
                    fontWeight: 800,
                    fontSize: 12,
                    letterSpacing: ".05em",
                    textTransform: "uppercase",
                  }}
                >
                  Week (Monday)
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="card-content" style={{ padding: 0, overflow: "visible" }}>
          <div className="responsive-table" style={{ overflowX: "auto", overflowY: "visible" }}>
            <table
              className="highlight"
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Week", "Employee", "Entries", "Accomplishments", "Blockers", "Next", "Hours"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          background: "#f8fafc",
                          color: "#334155",
                          fontSize: 12,
                          textTransform: "uppercase",
                          letterSpacing: ".06em",
                          fontWeight: 900,
                          padding: "16px 14px",
                          borderBottom: "1px solid rgba(148,163,184,.14)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, color: "#64748b" }}>
                      Loading...
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, color: "#dc2626", fontWeight: 700 }}>
                      {error}
                    </td>
                  </tr>
                )}

                {!loading && !error && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, color: "#64748b" }}>
                      No data
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  rows.map((r, idx) => {
                    const rowKey = `${r.weekStart}__${r.userId || r.userName || idx}`;
                    const hoursTone = colorForHours(Number(r.totalHours || 0));

                    return (
                      <tr key={rowKey} style={{ background: idx % 2 === 0 ? "#ffffff" : "#fcfdff" }}>
                        <td
                          style={{
                            padding: "16px 14px",
                            borderBottom: "1px solid rgba(148,163,184,.10)",
                            whiteSpace: "nowrap",
                            fontWeight: 800,
                            color: "#0f172a",
                          }}
                        >
                          {r.weekStart}
                        </td>

                        <td
                          style={{
                            padding: "16px 14px",
                            borderBottom: "1px solid rgba(148,163,184,.10)",
                            minWidth: 180,
                          }}
                        >
                          <div style={{ fontWeight: 900, color: "#0f172a" }}>
                            {r.userName || r.userId || "Anon"}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                            {r.employee_id || r.employee_manager || "—"}
                          </div>
                        </td>

                        <td
                          style={{
                            padding: "16px 14px",
                            borderBottom: "1px solid rgba(148,163,184,.10)",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              minWidth: 40,
                              justifyContent: "center",
                              padding: "6px 10px",
                              borderRadius: 999,
                              background: "rgba(99,102,241,.10)",
                              color: "#4338ca",
                              fontWeight: 900,
                            }}
                          >
                            {r.totalEntries}
                          </span>
                        </td>

                        <td style={{ padding: "16px 14px", borderBottom: "1px solid rgba(148,163,184,.10)" }}>
                          <CompactListCell
                            title="Accomplishments"
                            items={Array.isArray(r.accomplishments) ? r.accomplishments : []}
                            cellId={`${rowKey}__acc`}
                            hoveredCellId={hoveredCellId}
                            setHoveredCellId={setHoveredCellId}
                          />
                        </td>

                        <td style={{ padding: "16px 14px", borderBottom: "1px solid rgba(148,163,184,.10)" }}>
                          <CompactListCell
                            title="Blockers"
                            items={Array.isArray(r.blockers) ? r.blockers : []}
                            cellId={`${rowKey}__blk`}
                            hoveredCellId={hoveredCellId}
                            setHoveredCellId={setHoveredCellId}
                          />
                        </td>

                        <td style={{ padding: "16px 14px", borderBottom: "1px solid rgba(148,163,184,.10)" }}>
                          <CompactListCell
                            title="Next"
                            items={Array.isArray(r.next) ? r.next : []}
                            cellId={`${rowKey}__next`}
                            hoveredCellId={hoveredCellId}
                            setHoveredCellId={setHoveredCellId}
                          />
                        </td>

                        <td
                          style={{
                            padding: "16px 14px",
                            borderBottom: "1px solid rgba(148,163,184,.10)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <div
                            style={{ position: "relative", display: "inline-block" }}
                            onMouseEnter={() => setHoveredHoursKey(rowKey)}
                            onMouseLeave={() =>
                              setHoveredHoursKey((curr) => (curr === rowKey ? null : curr))
                            }
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 12px",
                                borderRadius: 999,
                                background: hoursTone.bg,
                                color: hoursTone.text,
                                fontWeight: 900,
                                boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)",
                                cursor: "default",
                              }}
                            >
                              <i className="material-icons" style={{ fontSize: 16 }}>
                                schedule
                              </i>
                              {Number(r.totalHours || 0).toFixed(1)}
                            </span>

                            {hoveredHoursKey === rowKey && (
                              <HeatmapPopover
                                weekStart={r.weekStart}
                                timesheet={Array.isArray(r.timesheet) ? r.timesheet : []}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}