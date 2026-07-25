// src/pages/Applicants.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { ApiApplicantDetails, ApiApplicantListItem, ApiUser } from "../api";
import ApplicantComposerModal, { type ApplicantRowLite, type Stage } from "../components/ApplicantComposerModal";
import ApplicantDetailsModal from "../components/ApplicantDetailsModal";
import ApplicantShareModal from "../components/ApplicantShareModal";

declare const M: any;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function parseDateSafe(iso?: string) {
  const s = safeStr(iso);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function fmtDate(iso?: string) {
  const d = parseDateSafe(iso);
  if (!d) return "—";
  try {
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toLocaleString();
  }
}

// ------------------------------------------------------------
// Status → Stage guess + badges (list view only)
// ------------------------------------------------------------
function guessStageFromStatus(statusRaw: string): Stage | "Unknown" {
  const s = safeStr(statusRaw).toLowerCase();
  if (!s) return "Unknown";
  if (s.includes("reject")) return "Reject";
  if (s.includes("welcome")) return "Welcome";
  if (s.includes("offer")) return "Offer";
  if (s.includes("nda")) return "NDA";
  if (s.includes("confirm")) return "Confirmation";
  if (s.includes("tech")) return "Technical Interview";
  if (s.includes("intro")) return "Introduction";
  return "Unknown";
}

type BadgeStyle = { bg: string; border: string; fg: string };

const STAGE_BADGE: Record<Stage, BadgeStyle> = {
  Reject: { bg: "#FDE8E8", border: "#F9B4B4", fg: "#8B1E1E" },
  Introduction: { bg: "#FCE7F3", border: "#F9A8D4", fg: "#9D174D" },
  "Technical Interview": { bg: "#E3EEFF", border: "#94BFFF", fg: "#163A8A" },
  Confirmation: { bg: "#F2E8FF", border: "#CFA7FF", fg: "#4B1E8B" },
  NDA: { bg: "#FEF3C7", border: "#FCD34D", fg: "#92400E" },
  Offer: { bg: "#CFFAFE", border: "#67E8F9", fg: "#155E75" },
  Welcome: { bg: "#E9F9EF", border: "#9FE0B5", fg: "#14532D" },
  "AI Intro": { bg: "#EDE9FE", border: "#C4B5FD", fg: "#4C1D95" },
};

function StatusPill({ status, stageGuess }: { status: string; stageGuess: Stage | "Unknown" }) {
  const s = safeStr(status) || "—";
  const stg: Stage = stageGuess === "Unknown" ? "Introduction" : (stageGuess as Stage);
  const statusKey = safeStr(status).toLowerCase();
  const css = statusKey === "applied"
    ? { bg: "#DCFCE7", border: "#86EFAC", fg: "#166534" }
    : statusKey.includes("intro_sent")
    ? { bg: "#FCE7F3", border: "#F9A8D4", fg: "#9D174D" }
    : STAGE_BADGE[stg];

  return (
    <span
      title={s}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 11px",
        borderRadius: 999,
        border: `1px solid ${css.border}`,
        background: css.bg,
        color: css.fg,
        fontWeight: 1000,
        lineHeight: "16px",
        maxWidth: 260,
        transition: "transform 120ms ease, box-shadow 120ms ease",
      }}
      className="fg-pill"
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: css.fg,
          opacity: 0.9,
          flex: "0 0 auto",
        }}
      />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s}</span>
    </span>
  );
}

// ------------------------------------------------------------
// Normalize list
// ------------------------------------------------------------
type ApplicantRow = {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  roleId: string;
  gender: string;
  status: string;
  submittedAt: string;
  createdAt: string;
  raw: ApiApplicantListItem;
};

function pickPayloadValueByNeedle(payload: any, needles: string[]) {
  const targets = needles.map((x) => x.toLowerCase());
  const buckets = [
    payload?.applicant,
    payload?.answersReadable,
    payload?.answers_readable,
    payload?.answers_readable_map,
    payload?.answers,
    payload?.answersRaw,
    payload?.answers_raw,
    payload,
  ];

  for (const bucket of buckets) {
    if (!bucket || typeof bucket !== "object") continue;
    for (const [key, value] of Object.entries(bucket)) {
      const k = String(key || "").toLowerCase();
      if (targets.some((needle) => k.includes(needle))) {
        const s = safeStr(value).trim();
        if (s) return s;
      }
    }
  }

  return "";
}

function normalizeListItem(a: ApiApplicantListItem): ApplicantRow {
  const payload = (a as any).payload || {};
  const roleId = safeStr((a as any).roleId || payload?.role?.id || payload?.answers?.roleId);

  return {
    id: safeStr((a as any).applicant_id || (a as any).id || (a as any).applicantId),
    name: safeStr((a as any).fullName || payload?.applicant?.fullName),
    email: safeStr((a as any).email || payload?.applicant?.email),
    roleTitle: safeStr((a as any).roleTitle || payload?.role?.title || payload?.answers?.roleTitle),
    roleId,
    gender: safeStr((a as any).gender || pickPayloadValueByNeedle(payload, ["gender", "pronoun"])),
    status: safeStr((a as any).status),
    submittedAt: safeStr((a as any).submittedAt),
    createdAt: safeStr((a as any).createdAt),
    raw: a,
  };
}

// ------------------------------------------------------------
// Sorting + UI
// ------------------------------------------------------------
type SortKey = "submitted" | "name" | "role" | "status";
type SortDir = "asc" | "desc";
type PipelineFilter = "All" | "Active" | "Rejected" | "Converted";

type MonthGroup = {
  key: string;
  label: string;
  items: ApplicantRow[];
  count: number;
  latestTs: number;
};

type YearGroup = {
  key: string;
  label: string;
  items: MonthGroup[];
  count: number;
  latestTs: number;
};

function sortTriangle(active: boolean, dir: SortDir) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", marginLeft: 6, opacity: active ? 1 : 0.35 }}>
      <i className="material-icons" style={{ fontSize: 14, lineHeight: "14px" }}>
        {dir === "asc" ? "arrow_drop_up" : "arrow_drop_down"}
      </i>
    </span>
  );
}

export default function Applicants() {
  const { api } = useAuth();

  // list + paging
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ApplicantRow[]>([]);
  const [query, setQuery] = useState("");
  const [totalMatches, setTotalMatches] = useState<number | null>(null);

  const [pageSize, setPageSize] = useState<number>(25);

  // filters
  const [pipeline, setPipeline] = useState<PipelineFilter>("Active");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [genderFilter, setGenderFilter] = useState<string>("All");
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [genderOptions, setGenderOptions] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // sort
  const [sortKey, setSortKey] = useState<SortKey>("submitted");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedYear, setSelectedYear] = useState<string>("");

  // details modal (now separate component)
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsRaw, setDetailsRaw] = useState<ApiApplicantDetails | null>(null);
  const [employees, setEmployees] = useState<ApiUser[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareApplicantId, setShareApplicantId] = useState("");
  const [shareApplicantName, setShareApplicantName] = useState("");
  const [shareApplicantEmail, setShareApplicantEmail] = useState("");

  // composer modal
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerApplicant, setComposerApplicant] = useState<ApplicantRowLite | null>(null);
  const [composerPrefill, setComposerPrefill] = useState<{ address?: string; city?: string }>({});
  const [composerQueued, setComposerQueued] = useState(false);

  const Css = (
    <style>{`
      .fg-bg {
        background: radial-gradient(1200px 520px at 18% -12%, rgba(255, 193, 7, 0.20), transparent 55%),
                    radial-gradient(900px 460px at 82% -25%, rgba(33, 150, 243, 0.14), transparent 55%),
                    radial-gradient(900px 420px at 90% 110%, rgba(156, 39, 176, 0.10), transparent 60%);
      }
      .fg-card {
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 14px 34px rgba(0,0,0,0.06);
        border: 1px solid rgba(0,0,0,0.06);
        background: #fff;
        transform: translateZ(0);
      }
      .fg-card-h {
        padding: 12px 14px;
        border-bottom: 1px solid rgba(0,0,0,0.06);
        background: linear-gradient(180deg, rgba(0,0,0,0.03), rgba(0,0,0,0.00));
      }
      .fg-card-b { padding: 14px; }
      .fg-row:hover { background: rgba(0,0,0,0.02); }
      .fg-pill:hover { transform: translateY(-1px); box-shadow: 0 10px 18px rgba(0,0,0,0.10); }
      .fg-btn {
        border-radius: 12px !important;
        font-weight: 900 !important;
        letter-spacing: 0.2px;
        transition: transform 120ms ease, box-shadow 120ms ease;
      }
      .fg-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 22px rgba(0,0,0,0.12); }
      .fg-kpi {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }
      @media (max-width: 900px) { .fg-kpi { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 620px) { .fg-kpi { grid-template-columns: 1fr; } }
      .fg-kpi .box{
        padding: 12px;
        border-radius: 16px;
        background: rgba(0,0,0,0.02);
        border: 1px solid rgba(0,0,0,0.06);
      }
      .fg-kpi .k { font-size: 12px; font-weight: 1000; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.6px; }
      .fg-kpi .v { font-size: 16px; font-weight: 1100; margin-top: 6px; }
      .fg-th {
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
      }
      .fg-th:hover { text-decoration: underline; }
      .fg-filter-grid {
        display: grid;
        grid-template-columns: minmax(240px, 1.4fr) repeat(4, minmax(150px, 1fr));
        gap: 14px;
        align-items: end;
      }
      .fg-filter-dates {
        display: grid;
        grid-template-columns: repeat(2, minmax(160px, 1fr)) auto;
        gap: 14px;
        align-items: end;
        margin-top: 14px;
      }
      .fg-filter-field label,
      .fg-filter-label {
        display: block;
        color: rgba(0,0,0,0.48);
        font-size: 12px;
        font-weight: 1000;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .fg-filter-field input,
      .fg-filter-field select {
        margin: 0 !important;
      }
      .fg-filter-actions {
        display: flex;
        justify-content: flex-end;
      }
      .fg-month-list {
        display: grid;
        gap: 14px;
      }
      .fg-year-strip {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
      }
      .fg-year-chip {
        height: 36px;
        padding: 0 14px;
        border-radius: 999px;
        border: 1px solid rgba(15,23,42,0.14);
        background: rgba(15,23,42,0.04);
        color: #0f172a;
        font-weight: 1000;
        font-size: 13px;
        cursor: pointer;
        transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease, color 120ms ease;
      }
      .fg-year-chip:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 18px rgba(0,0,0,0.08);
      }
      .fg-year-chip.active {
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: #fff;
        border-color: rgba(29,78,216,0.22);
      }
      .fg-year-meta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(37,99,235,0.06);
        color: #1e3a8a;
        font-weight: 900;
        font-size: 13px;
      }
      .fg-month-panel {
        border-radius: 18px;
        overflow: hidden;
        border: 1px solid rgba(0,0,0,0.08);
        background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,251,253,0.98));
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
      }
      .fg-month-summary {
        list-style: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 14px 16px;
        cursor: pointer;
        user-select: none;
        background: linear-gradient(180deg, rgba(37,99,235,0.08), rgba(37,99,235,0.03));
        border-bottom: 1px solid rgba(0,0,0,0.06);
      }
      .fg-month-summary::-webkit-details-marker { display: none; }
      .fg-month-title {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .fg-month-title .label {
        font-size: 16px;
        font-weight: 1100;
        color: #0f172a;
      }
      .fg-month-title .meta {
        font-size: 12px;
        font-weight: 800;
        color: #64748b;
      }
      .fg-month-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 40px;
        height: 28px;
        padding: 0 10px;
        border-radius: 999px;
        background: rgba(15,23,42,0.08);
        color: #0f172a;
        font-weight: 1000;
        font-size: 12px;
      }
      .fg-month-body {
        padding: 0;
      }
      .fg-month-table-wrap {
        overflow-x: auto;
      }
      @media (max-width: 1000px) {
        .fg-filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 640px) {
        .fg-filter-grid,
        .fg-filter-dates { grid-template-columns: 1fr; }
        .fg-filter-actions { justify-content: flex-start; }
      }
    `}</style>
  );

  const filtered = rows;

  const sortPreset = `${sortKey}:${sortDir}`;

  function applySortPreset(value: string) {
    const [key, dir] = value.split(":") as [SortKey, SortDir];
    setSortKey(key || "submitted");
    setSortDir(dir || "desc");
  }

  const kpis = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => {
      const st = guessStageFromStatus(r.status);
      return st !== "Reject" && st !== "Welcome";
    }).length;
    const rejected = rows.filter((r) => guessStageFromStatus(r.status) === "Reject").length;
    const converted = rows.filter((r) => guessStageFromStatus(r.status) === "Welcome").length;
    return { total, active, rejected, converted };
  }, [rows]);

  const yearGroups = useMemo<YearGroup[]>(() => {
    const buckets = new Map<string, YearGroup>();

    for (const row of filtered) {
      const submitted = parseDateSafe(row.submittedAt || row.createdAt);
      const created = parseDateSafe(row.createdAt);
      const monthDate = submitted || created;
      const yearKey = monthDate ? String(monthDate.getFullYear()) : "unknown";
      const yearLabel = monthDate ? String(monthDate.getFullYear()) : "Unknown year";
      const monthKey = monthDate
        ? `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`
        : "unknown";
      const monthLabel = monthDate
        ? monthDate.toLocaleString(undefined, { year: "numeric", month: "long" })
        : "Unknown month";
      const latestTs = monthDate ? monthDate.getTime() : 0;

      let yearGroup = buckets.get(yearKey);
      if (!yearGroup) {
        yearGroup = { key: yearKey, label: yearLabel, items: [], count: 0, latestTs };
        buckets.set(yearKey, yearGroup);
      }
      yearGroup.count += 1;
      yearGroup.latestTs = Math.max(yearGroup.latestTs, latestTs);

      const existingMonth = yearGroup.items.find((month) => month.key === monthKey);
      if (!existingMonth) {
        yearGroup.items.push({ key: monthKey, label: monthLabel, items: [row], count: 1, latestTs });
      } else {
        existingMonth.items.push(row);
        existingMonth.count += 1;
        existingMonth.latestTs = Math.max(existingMonth.latestTs, latestTs);
      }
    }

    return Array.from(buckets.values())
      .map((year) => ({
        ...year,
        items: year.items.sort((a, b) => b.latestTs - a.latestTs),
      }))
      .sort((a, b) => b.latestTs - a.latestTs);
  }, [filtered]);

  const activeYearGroup = useMemo(() => {
    if (!yearGroups.length) return null;
    return yearGroups.find((group) => group.key === selectedYear) || yearGroups[0];
  }, [yearGroups, selectedYear]);

  useEffect(() => {
    if (!yearGroups.length) {
      if (selectedYear) setSelectedYear("");
      return;
    }

    const currentYear = String(new Date().getFullYear());
    const nextSelected =
      yearGroups.find((group) => group.key === selectedYear)?.key ||
      yearGroups.find((group) => group.key === currentYear)?.key ||
      yearGroups[0].key;

    if (nextSelected !== selectedYear) {
      setSelectedYear(nextSelected);
    }
  }, [yearGroups, selectedYear]);

  async function loadApplicantsPage(limitOverride?: number) {
    setLoading(true);
    try {
      const limit = limitOverride || pageSize;
      const collected: ApplicantRow[] = [];
      let cursor: string | undefined = undefined;
      let nextPage: any = null;
      let guard = 0;

      do {
        nextPage = await (api as any).getApplicantsPage({
          limit,
          cursor,
          query: query.trim() || undefined,
          pipeline,
          role: roleFilter === "All" ? undefined : roleFilter,
          gender: genderFilter === "All" ? undefined : genderFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sortKey,
          sortDir,
        });

        const items = Array.isArray(nextPage?.items) ? nextPage.items : [];
        collected.push(...items.map(normalizeListItem).filter((x: any) => !!x.id));
        cursor = typeof nextPage?.nextCursor === "string" && nextPage.nextCursor ? nextPage.nextCursor : undefined;
        guard += 1;
      } while (cursor && guard < 100);

      setRows(collected);
      setTotalMatches(Number.isFinite(Number(nextPage?.count)) ? Number(nextPage.count) : collected.length);
      setRoleOptions(Array.isArray(nextPage?.roleOptions) ? nextPage.roleOptions : []);
      setGenderOptions(Array.isArray(nextPage?.genderOptions) ? nextPage.genderOptions : []);
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Failed to load applicants", classes: "red" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const delay = query.trim() ? 300 : 0;
    const id = window.setTimeout(() => loadApplicantsPage(), delay);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, pipeline, roleFilter, genderFilter, dateFrom, dateTo, sortKey, sortDir, pageSize]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api.getUsers();
        if (!mounted) return;
        setEmployees(Array.isArray(data) ? data : []);
      } catch {
        if (mounted) setEmployees([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [api]);

  async function onView(r: ApplicantRow) {
    setDetailsRaw(null);
    setDetailsLoading(true);
    setDetailsOpen(true);

    try {
      const d = await api.getApplicantById(r.id);
      setDetailsRaw(d);
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Failed to load applicant details", classes: "red" });
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeDetails() {
    setDetailsOpen(false);
    window.setTimeout(() => setDetailsRaw(null), 160);
  }

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
      return;
    }
    setSortDir((d) => (d === "desc" ? "asc" : "desc"));
  }

  const legend = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      {Object.keys(STAGE_BADGE).map((s) => (
        <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: (STAGE_BADGE as any)[s].fg, opacity: 0.8 }} />
          <span className="grey-text" style={{ fontSize: 12, fontWeight: 1000 }}>
            {s}
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <>
      {Css}

      <main className="container fg-bg" style={{ paddingTop: 24, maxWidth: 1180, paddingBottom: 34 }}>
        {/* Header */}
        <div className="row" style={{ alignItems: "center" }}>
          <div className="col s12 m8">
            <h4 style={{ margin: 0, fontWeight: 1100, letterSpacing: 0.2 }}>Applicants</h4>
            <p className="grey-text" style={{ marginTop: 6, fontWeight: 800 }}>
              {loading
                ? "Loading…"
                : `${totalMatches ?? kpis.total} matching applicants • ${filtered.length} shown`}
            </p>
          </div>

          <div className="col s12 m4 right-align" style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button
              className={`btn fg-btn ${loading ? "disabled" : ""}`}
              onClick={() => loadApplicantsPage()}
              disabled={loading}
            >
              <i className="material-icons left">refresh</i>
              Refresh
            </button>

            <button
              className="btn-flat"
              onClick={() => {
                setSortKey("submitted");
                setSortDir("desc");
              }}
            >
              <i className="material-icons left">sort</i>
              Clear sort
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className="fg-card" style={{ marginBottom: 14 }}>
          <div className="fg-card-b">
            <div className="fg-kpi">
              <div className="box">
                <div className="k">Active</div>
                <div className="v">{kpis.active}</div>
              </div>
              <div className="box">
                <div className="k">Rejected</div>
                <div className="v">{kpis.rejected}</div>
              </div>
              <div className="box">
                <div className="k">Converted</div>
                <div className="v">{kpis.converted}</div>
              </div>
              <div className="box">
                <div className="k">Batch size</div>
                <div className="v">{pageSize}</div>
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[25, 50, 100].map((n) => (
                    <button
                      key={n}
                      className={`btn-small ${pageSize === n ? "" : "grey lighten-2"} fg-btn`}
                      onClick={() => {
                        setPageSize(n);
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="card-panel" style={{ marginTop: 12, padding: "10px 12px", borderRadius: 14, background: "#FAFAFA", border: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 1100, marginBottom: 6 }}>Legend</div>
              {legend}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="fg-card">
          <div className="fg-card-b" style={{ paddingBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 1100, fontSize: 18 }}>Filters</div>
                  <div className="grey-text" style={{ fontWeight: 900, fontSize: 12 }}>
                {totalMatches ?? filtered.length} matching applicants
                  </div>
                </div>

            <div className="fg-filter-grid" style={{ marginTop: 12 }}>
              <div className="fg-filter-field">
                <label htmlFor="searchApplicants">Search</label>
                <input
                  id="searchApplicants"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, email, role, status…"
                />
              </div>

              <div className="fg-filter-field">
                <label htmlFor="sortApplicants">Sort</label>
                <select id="sortApplicants" className="browser-default" value={sortPreset} onChange={(e) => applySortPreset(e.target.value)}>
                  <option value="submitted:desc">Date applied, newest first</option>
                  <option value="submitted:asc">Date applied, oldest first</option>
                  <option value="name:asc">Name, A to Z</option>
                  <option value="name:desc">Name, Z to A</option>
                  <option value="role:asc">Role applied, A to Z</option>
                  <option value="role:desc">Role applied, Z to A</option>
                  <option value="status:asc">Status, A to Z</option>
                  <option value="status:desc">Status, Z to A</option>
                </select>
              </div>

              <div className="fg-filter-field">
                <label htmlFor="roleApplicants">Role Applied</label>
                <select id="roleApplicants" className="browser-default" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="All">All roles</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div className="fg-filter-field">
                <label htmlFor="genderApplicants">Gender</label>
                <select id="genderApplicants" className="browser-default" value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
                  <option value="All">All genders</option>
                  {genderOptions.map((gender) => (
                    <option key={gender} value={gender}>{gender}</option>
                  ))}
                </select>
              </div>

              <div className="fg-filter-field">
                <label htmlFor="statusApplicants">Status</label>
                <select id="statusApplicants" className="browser-default" value={pipeline} onChange={(e) => setPipeline(e.target.value as any)}>
                  <option value="Active">Active pipeline</option>
                  <option value="All">All</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Converted">Converted (Welcome)</option>
                </select>
              </div>
            </div>

            <div className="fg-filter-dates">
              <div className="fg-filter-field">
                <label>Applied From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>

              <div className="fg-filter-field">
                <label>Applied To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>

              <div className="fg-filter-actions">
                <button
                  className="btn-flat"
                  onClick={() => {
                    setQuery("");
                    setPipeline("Active");
                    setRoleFilter("All");
                    setGenderFilter("All");
                    setDateFrom("");
                    setDateTo("");
                    setSortKey("submitted");
                    setSortDir("desc");
                  }}
                >
                  <i className="material-icons left">tune</i>
                  Reset filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="fg-card" style={{ marginTop: 14 }}>
          <div className="fg-card-b">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 1100, fontSize: 18 }}>Applicant Timeline</div>
              <div className="grey-text" style={{ fontWeight: 900, fontSize: 12 }}>
                Applicants are grouped by year first, then by month.
              </div>
            </div>

            {loading ? (
              <div className="center grey-text" style={{ padding: "24px 0" }}>Loadingâ€¦</div>
            ) : !filtered.length ? (
              <div className="center grey-text" style={{ padding: "24px 0" }}>No applicants found.</div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <div className="fg-year-strip">
                  {yearGroups.map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      className={`fg-year-chip ${activeYearGroup?.key === group.key ? "active" : ""}`}
                      onClick={() => setSelectedYear(group.key)}
                    >
                      {group.label}
                    </button>
                  ))}
                </div>

                {activeYearGroup ? (
                  <div className="fg-year-meta">
                    <i className="material-icons" style={{ fontSize: 18 }}>event</i>
                    <span>
                      {activeYearGroup.label} • {activeYearGroup.count} applicant{activeYearGroup.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                ) : null}

                <div className="fg-month-list" style={{ marginTop: 12 }}>
                  {(activeYearGroup?.items || []).map((group, idx) => (
                  <details key={group.key} className="fg-month-panel" open={idx === 0}>
                    <summary className="fg-month-summary">
                      <div className="fg-month-title">
                        <div className="label">{group.label}</div>
                        <div className="meta">
                          {group.count} applicant{group.count !== 1 ? "s" : ""} in this month
                        </div>
                      </div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <span className="fg-month-count">{group.count}</span>
                        <i className="material-icons" style={{ color: "#334155" }}>expand_more</i>
                      </div>
                    </summary>

                    <div className="fg-month-body">
                      <div className="fg-month-table-wrap">
                        <table className="highlight responsive-table" style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th className="fg-th" onClick={() => toggleSort("name")}>Name {sortTriangle(sortKey === "name", sortDir)}</th>
                              <th>Email</th>
                              <th className="fg-th" onClick={() => toggleSort("role")}>Role {sortTriangle(sortKey === "role", sortDir)}</th>
                              <th>Gender</th>
                              <th className="fg-th" onClick={() => toggleSort("status")}>Status {sortTriangle(sortKey === "status", sortDir)}</th>
                              <th className="fg-th" onClick={() => toggleSort("submitted")}>Submitted {sortTriangle(sortKey === "submitted", sortDir)}</th>
                              <th className="right-align">Actions</th>
                            </tr>
                          </thead>

                          <tbody>
                            {group.items.map((r) => {
                              const stageGuess = guessStageFromStatus(r.status);
                              return (
                                <tr key={r.id} className="fg-row">
                                  <td><b style={{ fontWeight: 1100 }}>{r.name || "â€”"}</b></td>
                                  <td><code>{r.email || "â€”"}</code></td>
                                  <td>
                                    <div style={{ fontWeight: 1000 }}>{r.roleTitle || "â€”"}</div>
                                    {r.roleId ? <div className="grey-text" style={{ fontSize: 12 }}>{r.roleId}</div> : null}
                                  </td>
                                  <td className="grey-text" style={{ fontWeight: 900 }}>{r.gender || "â€”"}</td>
                                  <td><StatusPill status={r.status || "â€”"} stageGuess={stageGuess} /></td>
                                  <td className="grey-text" style={{ whiteSpace: "nowrap", fontWeight: 900 }}>
                                    {fmtDate(r.submittedAt || r.createdAt)}
                                  </td>
                                  <td className="right-align" style={{ minWidth: 120 }}>
                                    <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                      <button
                                        className="btn-small grey darken-2 fg-btn"
                                        onClick={() => onView(r)}
                                        title="View applicant"
                                        aria-label="View applicant"
                                        style={{ width: 42, padding: 0, display: "inline-flex", justifyContent: "center" }}
                                      >
                                        <i className="material-icons" style={{ fontSize: 18 }}>visibility</i>
                                      </button>
                                      <button
                                        className="btn-small blue darken-2 fg-btn"
                                        onClick={() => {
                                          setShareApplicantId(r.id);
                                          setShareApplicantName(r.name);
                                          setShareApplicantEmail(r.email);
                                          setShareOpen(true);
                                        }}
                                        title="Share applicant"
                                        aria-label="Share applicant"
                                        style={{ width: 42, padding: 0, display: "inline-flex", justifyContent: "center" }}
                                      >
                                        <i className="material-icons" style={{ fontSize: 18 }}>share</i>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ✅ DETAILS MODAL (new component) */}
      <ApplicantDetailsModal
        open={detailsOpen}
        loading={detailsLoading}
        detailsRaw={detailsRaw}
        onClose={closeDetails}
        onClosed={() => {
          if (!composerQueued) return;
          setComposerQueued(false);
          setComposerOpen(true);
        }}
        onOpenComposer={(lite, prefill) => {
          setComposerApplicant(lite);
          setComposerPrefill(prefill || {});
          setComposerQueued(true);
          setDetailsOpen(false);
        }}
      />

      {/* ✅ Reusable Composer Modal */}
      <ApplicantComposerModal
        api={api}
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        applicant={composerApplicant}
        prefillAddress={composerPrefill.address}
        prefillCity={composerPrefill.city}
      />

      <ApplicantShareModal
        api={api}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        applicantId={shareApplicantId}
        applicantName={shareApplicantName}
        applicantEmail={shareApplicantEmail}
        employeeOptions={employees.filter((employee) => {
          const role = String((employee as any).employee_role || (employee as any).role || "").toLowerCase();
          return !!safeStr(employee.employee_email) && (role === "employee" || role === "admin" || role === "super" || !role);
        })}
      />
    </>
  );
}
