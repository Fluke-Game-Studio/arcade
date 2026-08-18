import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useAuth } from "../auth/AuthContext";

const WEEKS_TRACKED = 8;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Validated ordinal green ramp (light surface #fcfcfb) — see dataviz skill:
// single hue, monotone lightness, light-end clears 2:1 contrast on white.
// "0 hours" deliberately isn't part of this ramp — it's a neutral/absent
// cell (like GitHub's empty-day gray), not the lightest step of the scale.
const HEAT_STEPS = ["#20c55d", "#189546", "#116931", "#0b421f"];
const HEAT_EMPTY = "rgba(15,23,42,0.06)";

// Categorical slot 1 (blue) from the validated reference palette.
const LINE_COLOR = "#2a78d6";
const POINT_EMPTY = "rgba(148,163,184,.7)";
// Baseline/axis hairline + gridline from the validated palette's chart-chrome table.
const CHART_BASELINE = "#c3c2b7";
const CHART_GRIDLINE = "#e1e0d9";

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

function todayISO() {
  const x = new Date();
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function firstOfMonthISO(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

function dayNum(iso: string) {
  return String(Number(iso.slice(8, 10)));
}

function shortDateLabel(iso: string) {
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

function heatColor(hours: number) {
  if (hours <= 0) return HEAT_EMPTY;
  if (hours < 2) return HEAT_STEPS[0];
  if (hours < 4) return HEAT_STEPS[1];
  if (hours < 6) return HEAT_STEPS[2];
  return HEAT_STEPS[3];
}

type WeekRow = { weekStart: string; filled: boolean };

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

function HeatLegend() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 800, marginRight: 2 }}>Less</span>
      {[HEAT_EMPTY, ...HEAT_STEPS].map((c, i) => (
        <span key={i} style={{ width: 9, height: 9, borderRadius: 2, background: c, display: "inline-block" }} />
      ))}
      <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 800, marginLeft: 2 }}>More</span>
    </div>
  );
}

// GitHub-contribution-style grid: one column per week, one row per weekday,
// each cell colored by that day's actual logged hours (not the week's total
// collapsed onto whichever day the update happened to be submitted).
function ContributionGridBody({ weekStarts, dailyHours }: { weekStarts: string[]; dailyHours: Map<string, number> }) {
  return (
    <div style={{ display: "inline-block" }}>
      <div style={{ display: "flex", gap: 3 }}>
        {weekStarts.map((weekStart) => (
          <div key={weekStart} style={{ display: "grid", gap: 3 }}>
            {DAY_LABELS.map((_, dayIdx) => {
              const date = addDays(weekStart, dayIdx);
              const hours = dailyHours.get(date) || 0;
              return (
                <span
                  key={date}
                  title={`${shortDateLabel(date)} — ${hours > 0 ? `${hours.toFixed(1)}h` : "no hours logged"}`}
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 3,
                    background: heatColor(hours),
                    display: "block",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
        {weekStarts.map((weekStart) => (
          <div key={weekStart} style={{ width: 13, textAlign: "center", fontSize: 8, color: "#94a3b8", fontWeight: 800 }}>
            {shortDateLabel(weekStart).slice(0, 2)}
          </div>
        ))}
      </div>
    </div>
  );
}

type LinePoint = { key: string; axisLabel: string; tooltipLabel: string; hours: number };
type SvgPoint = LinePoint & { x: number; y: number };
type SeriesKey = "week" | "month" | "all";

// Fixed categorical order, slots 1–3 of the validated reference palette —
// this is the trio the palette doc calls out as passing ALL-PAIRS CVD/
// contrast checks together (needed here since all three lines are ever
// on-screen at once, not swapped one-at-a-time).
const SERIES_DEFS: { key: SeriesKey; label: string; color: string }[] = [
  { key: "week", label: "This Week", color: LINE_COLOR },
  { key: "month", label: "Current Month", color: "#eb6834" },
  { key: "all", label: "All Time", color: "#1baf7a" },
];

const CHART_W = 600;
const CHART_H = 110;
const CHART_PAD_X = 8;
const CHART_PAD_TOP = 10;
const CHART_PAD_BOTTOM = 10;

// Three lines — this week, current month, all-time — overlaid on one chart.
// Each line's own point count is normalized to the full chart width (their
// real date ranges don't share a calendar axis), sharing a single y-scale
// so magnitudes stay comparable. A shared crosshair + tooltip shows the
// nearest point on all three at once.
function ActivityLineChart({
  dailyHours,
  allTime,
  allTimeLoading,
  allTimeError,
  onRequestAll,
}: {
  dailyHours: Map<string, number>;
  allTime: { weekStarts: string[]; daily: Map<string, number> } | null;
  allTimeLoading: boolean;
  allTimeError: string;
  onRequestAll: () => void;
}) {
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // All three series are shown together now, so all-time data is needed
  // up front rather than lazily on a toggle click — kick off the (already
  // idempotent) fetch as soon as this chart mounts.
  useEffect(() => {
    onRequestAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weekData = useMemo<LinePoint[]>(() => {
    const weekStart = mondayISO(new Date());
    return DAY_LABELS.map((label, i) => {
      const date = addDays(weekStart, i);
      return { key: date, axisLabel: label, tooltipLabel: `${label} (${shortDateLabel(date)})`, hours: dailyHours.get(date) || 0 };
    });
  }, [dailyHours]);

  const monthData = useMemo<LinePoint[]>(() => {
    const today = todayISO();
    const start = firstOfMonthISO(today);
    const out: LinePoint[] = [];
    let d = start;
    let guard = 0;
    while (d <= today && guard < 31) {
      out.push({ key: d, axisLabel: dayNum(d), tooltipLabel: shortDateLabel(d), hours: dailyHours.get(d) || 0 });
      d = addDays(d, 1);
      guard += 1;
    }
    return out;
  }, [dailyHours]);

  const allData = useMemo<LinePoint[]>(() => {
    if (!allTime) return [];
    return allTime.weekStarts.map((weekStart) => {
      const hours = DAY_LABELS.reduce((sum, _, i) => sum + (allTime.daily.get(addDays(weekStart, i)) || 0), 0);
      return { key: weekStart, axisLabel: shortDateLabel(weekStart), tooltipLabel: `Week of ${shortDateLabel(weekStart)}`, hours };
    });
  }, [allTime]);

  const seriesData: Record<SeriesKey, LinePoint[]> = { week: weekData, month: monthData, all: allData };

  // One shared y-scale across all three lines — never a dual/triple axis.
  const sharedMax = Math.max(
    1,
    ...weekData.map((d) => d.hours),
    ...monthData.map((d) => d.hours),
    ...allData.map((d) => d.hours)
  );

  function toSvgPoints(list: LinePoint[]): SvgPoint[] {
    const innerW = CHART_W - CHART_PAD_X * 2;
    const innerH = CHART_H - CHART_PAD_TOP - CHART_PAD_BOTTOM;
    return list.map((d, i) => {
      const x = list.length > 1 ? CHART_PAD_X + (i / (list.length - 1)) * innerW : CHART_W / 2;
      const y = CHART_PAD_TOP + innerH - clamp01(d.hours / sharedMax) * innerH;
      return { ...d, x, y };
    });
  }

  const seriesPoints = useMemo(
    () => ({ week: toSvgPoints(weekData), month: toSvgPoints(monthData), all: toSvgPoints(allData) }) as Record<SeriesKey, SvgPoint[]>,
    [weekData, monthData, allData, sharedMax]
  );

  const baselineY = CHART_H - CHART_PAD_BOTTOM;

  function pathFor(points: SvgPoint[]) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  }

  function handlePointerMove(e: ReactMouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoverFrac(clamp01((e.clientX - rect.left) / rect.width));
  }

  // Nearest point per series at the shared hover fraction — series lengths
  // differ, so each maps the same fraction to its own nearest index.
  const hoverPoints =
    hoverFrac === null
      ? null
      : SERIES_DEFS.map((s) => {
          const pts = seriesPoints[s.key];
          if (!pts.length) return null;
          const idx = Math.round(hoverFrac * (pts.length - 1));
          return { ...s, point: pts[idx] };
        }).filter((v): v is { key: SeriesKey; label: string; color: string; point: SvgPoint } => !!v);

  const hasAnyData = weekData.some((d) => d.hours > 0) || monthData.some((d) => d.hours > 0) || allData.some((d) => d.hours > 0);

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>Total Time Spent</div>

      {/* Legend — always present for 2+ series, doubles as each line's total */}
      <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        {SERIES_DEFS.map((s) => {
          const list = seriesData[s.key];
          const total = list.reduce((a, b) => a + b.hours, 0);
          const suffix = s.key === "all" && allTimeLoading ? "…" : s.key === "all" && allTimeError ? " (error)" : "";
          return (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b" }}>{s.label}</span>
              <span style={{ fontSize: 10, fontWeight: 900, color: "#0f172a" }}>
                {total.toFixed(1)}h{suffix}
              </span>
            </div>
          );
        })}
      </div>

      {!hasAnyData && !allTimeLoading ? (
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textAlign: "center", padding: "20px 0" }}>No data yet.</div>
      ) : (
        <div ref={containerRef} style={{ position: "relative" }}>
          <svg
            width="100%"
            height={CHART_H}
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="none"
            style={{ display: "block", overflow: "visible", cursor: "crosshair" }}
            onMouseMove={handlePointerMove}
            onMouseLeave={() => setHoverFrac(null)}
          >
            {/* Baseline (0-hours axis) */}
            <line x1={CHART_PAD_X} y1={baselineY} x2={CHART_W - CHART_PAD_X} y2={baselineY} stroke={CHART_BASELINE} strokeWidth={1} vectorEffect="non-scaling-stroke" />

            {/* Shared crosshair, drawn under the lines/markers */}
            {hoverFrac !== null && (
              <line
                x1={CHART_PAD_X + hoverFrac * (CHART_W - CHART_PAD_X * 2)}
                y1={CHART_PAD_TOP}
                x2={CHART_PAD_X + hoverFrac * (CHART_W - CHART_PAD_X * 2)}
                y2={baselineY}
                stroke={CHART_GRIDLINE}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}

            {SERIES_DEFS.map((s) => {
              const pts = seriesPoints[s.key];
              if (pts.length < 2) return null;
              return (
                <path
                  key={s.key}
                  d={pathFor(pts)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {/* Markers only at the hovered position, one per series, so three
                overlapping lines don't turn into a wall of dots at rest. */}
            {hoverPoints?.map((h) => (
              <circle
                key={h.key}
                cx={h.point.x}
                cy={h.point.y}
                r={3.5}
                fill={h.point.hours > 0 ? h.color : POINT_EMPTY}
                stroke="#fff"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 800 }}>Start</span>
            <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 800 }}>End</span>
          </div>

          {hoverPoints && hoverPoints.length > 0 && (
            <div
              style={{
                position: "absolute",
                left: `${clamp01(hoverFrac ?? 0) * 100}%`,
                top: Math.max(0, Math.min(...hoverPoints.map((h) => h.point.y)) - 14 * hoverPoints.length - 20),
                transform: "translateX(-50%)",
                background: "#0f172a",
                color: "#fff",
                fontSize: 10,
                fontWeight: 800,
                padding: "6px 9px",
                borderRadius: 7,
                pointerEvents: "none",
                whiteSpace: "nowrap",
                zIndex: 5,
                boxShadow: "0 8px 18px rgba(15,23,42,.25)",
                display: "grid",
                gap: 2,
              }}
            >
              {hoverPoints.map((h) => (
                <div key={h.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: h.color, display: "inline-block", flexShrink: 0 }} />
                  <span>
                    {h.point.tooltipLabel}: {h.point.hours.toFixed(1)}h
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MyActivitySummary() {
  const { api } = useAuth();
  const [rows, setRows] = useState<WeekRow[] | null>(null);
  const [dailyHours, setDailyHours] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState("");

  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [allTime, setAllTime] = useState<{ weekStarts: string[]; daily: Map<string, number> } | null>(null);
  const [allTimeLoading, setAllTimeLoading] = useState(false);
  const [allTimeError, setAllTimeError] = useState("");
  const popoverRootRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await api.getMyUpdates({ limit: WEEKS_TRACKED + 4 });
        if (!mounted) return;

        const byWeek = new Map<string, { totalHours: number; totalEntries: number }>();
        const daily = new Map<string, number>();
        for (const s of resp?.summaries || []) {
          const week = String((s as any)?.weekStart || "");
          if (week) {
            byWeek.set(week, {
              totalHours: safeNum((s as any)?.totalHours),
              totalEntries: safeNum((s as any)?.totalEntries),
            });
          }
          const timesheet = Array.isArray((s as any)?.timesheet) ? (s as any).timesheet : [];
          for (const row of timesheet) {
            const date = String(row?.date || "");
            if (!date) continue;
            daily.set(date, (daily.get(date) || 0) + safeNum(row?.hours));
          }
        }

        const thisWeek = mondayISO(new Date());
        const weeks: WeekRow[] = [];
        for (let i = WEEKS_TRACKED - 1; i >= 0; i--) {
          const weekStart = addDays(thisWeek, -7 * i);
          const entry = byWeek.get(weekStart);
          weeks.push({ weekStart, filled: !!entry && entry.totalEntries > 0 });
        }

        setRows(weeks);
        setDailyHours(daily);
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

  // Click-to-toggle, click-outside-to-close — no hover involved, so it
  // doesn't have the "closes before you can reach it" problem hover-driven
  // popovers have.
  useEffect(() => {
    if (!heatmapOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!popoverRootRef.current?.contains(e.target as Node)) setHeatmapOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [heatmapOpen]);

  // Scroll the all-time grid to show the most recent weeks by default, once
  // it's loaded and the popover is open.
  useEffect(() => {
    if (heatmapOpen && allTime && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [heatmapOpen, allTime]);

  function toggleHeatmap() {
    const next = !heatmapOpen;
    setHeatmapOpen(next);
    if (next) void loadAllTimeIfNeeded();
  }

  // Shared by the history icon's popover and the bar chart's "All Time"
  // toggle — whichever triggers it first does the fetch, the other reuses it.
  async function loadAllTimeIfNeeded() {
    if (allTime || allTimeLoading) return;

    setAllTimeLoading(true);
    setAllTimeError("");
    try {
      const byWeek = new Map<string, { totalHours: number; totalEntries: number }>();
      const daily = new Map<string, number>();
      let cursor: string | undefined;
      let pages = 0;
      do {
        const resp = await api.getMyUpdates({ limit: 100, cursor });
        for (const s of resp?.summaries || []) {
          const week = String((s as any)?.weekStart || "");
          if (week) {
            byWeek.set(week, {
              totalHours: safeNum((s as any)?.totalHours),
              totalEntries: safeNum((s as any)?.totalEntries),
            });
          }
          const timesheet = Array.isArray((s as any)?.timesheet) ? (s as any).timesheet : [];
          for (const row of timesheet) {
            const date = String(row?.date || "");
            if (!date) continue;
            daily.set(date, (daily.get(date) || 0) + safeNum(row?.hours));
          }
        }
        cursor = typeof resp?.nextCursor === "string" && resp.nextCursor ? resp.nextCursor : undefined;
        pages += 1;
      } while (cursor && pages < 50);

      const thisWeekStart = mondayISO(new Date());
      const weekKeys = Array.from(byWeek.keys());
      const earliest = weekKeys.length ? weekKeys.reduce((a, b) => (a < b ? a : b)) : thisWeekStart;

      // Build a continuous week-by-week column list from the earliest week
      // with any recorded activity through this week — including empty gaps,
      // same convention as GitHub's own contribution graph.
      const weekStarts: string[] = [];
      let cursorWeek = earliest;
      let guard = 0;
      while (cursorWeek <= thisWeekStart && guard < 600) {
        weekStarts.push(cursorWeek);
        cursorWeek = addDays(cursorWeek, 7);
        guard += 1;
      }

      setAllTime({ weekStarts, daily });
    } catch (e: any) {
      setAllTimeError(e?.message || "Failed to load all-time activity.");
    } finally {
      setAllTimeLoading(false);
    }
  }

  const stats = useMemo(() => {
    const list = rows || [];
    const filled = list.filter((r) => r.filled).length;
    return { filled, total: list.length };
  }, [rows]);

  return (
    <div className="card z-depth-1" style={{ borderRadius: 18, overflow: "visible" }}>
      <div
        ref={popoverRootRef}
        style={{
          position: "relative",
          padding: 14,
          borderBottom: "1px solid #edf2f7",
          background: "linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%)",
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>My Activity</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, fontWeight: 700 }}>
              Updates and hours — last {WEEKS_TRACKED} weeks
            </div>
          </div>

          <button
            type="button"
            onClick={toggleHeatmap}
            title="View all-time activity history"
            aria-label="View all-time activity history"
            aria-expanded={heatmapOpen}
            style={{
              flexShrink: 0,
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: "1px solid rgba(59,130,246,.35)",
              background: heatmapOpen ? "rgba(59,130,246,.14)" : "rgba(59,130,246,.06)",
              color: "#1d4ed8",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <i className="material-icons" style={{ fontSize: 15 }}>history</i>
          </button>
        </div>

        {heatmapOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 14,
              zIndex: 20,
              width: "min(420px, 90vw)",
              borderRadius: 16,
              border: "1px solid rgba(148,163,184,.22)",
              background: "#fff",
              boxShadow: "0 20px 50px rgba(15,23,42,.16)",
              padding: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>All-Time Activity</div>
                <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>
                  {allTime ? `${allTime.weekStarts.length} weeks tracked` : "Every week you've logged hours"}
                </div>
              </div>
              <HeatLegend />
            </div>

            {allTimeLoading ? (
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textAlign: "center", padding: "16px 0" }}>Loading…</div>
            ) : allTimeError ? (
              <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 700, textAlign: "center", padding: "16px 0" }}>{allTimeError}</div>
            ) : allTime && allTime.weekStarts.length ? (
              <div ref={scrollRef} style={{ overflowX: "auto", paddingBottom: 4 }}>
                <ContributionGridBody weekStarts={allTime.weekStarts} dailyHours={allTime.daily} />
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textAlign: "center", padding: "16px 0" }}>
                No activity recorded yet.
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: 16 }}>
        {rows === null ? (
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textAlign: "center", padding: "20px 0" }}>Loading…</div>
        ) : error ? (
          <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 700, textAlign: "center", padding: "20px 0" }}>{error}</div>
        ) : (
          <div style={{ display: "grid", gap: 18 }}>
            <div className="myActivityRowContainer">
              <style>{`
                /* container-type goes on the PARENT — the row inside queries
                   *this* element's width via @container, not the viewport,
                   since the card can be a narrow sidebar on desktop and
                   full-width on mobile (a viewport media query would get
                   that backwards). Falls back to the side-by-side 1fr/2fr
                   grid in browsers without @container support. */
                .myActivityRowContainer { container-type: inline-size; }
                .myActivityRow {
                  display: grid;
                  grid-template-columns: 1fr 2fr;
                  gap: 14px;
                  align-items: center;
                }
                @container (max-width: 300px) {
                  .myActivityRow { grid-template-columns: 1fr; }
                }
              `}</style>
              <div className="myActivityRow">
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <ComplianceDonut filled={stats.filled} total={stats.total} />
                </div>
                <ActivityLineChart
                  dailyHours={dailyHours}
                  allTime={allTime}
                  allTimeLoading={allTimeLoading}
                  allTimeError={allTimeError}
                  onRequestAll={loadAllTimeIfNeeded}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
