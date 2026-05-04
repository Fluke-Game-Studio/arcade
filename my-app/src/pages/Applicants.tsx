// src/pages/Applicants.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { ApiApplicantDetails, ApiApplicantListItem } from "../api";
import ApplicantComposerModal, { type ApplicantRowLite, type Stage } from "../components/ApplicantComposerModal";
import ApplicantDetailsModal from "../components/ApplicantDetailsModal";

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
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState<number>(0);

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

  // details modal (now separate component)
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsRaw, setDetailsRaw] = useState<ApiApplicantDetails | null>(null);

  // composer modal
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerApplicant, setComposerApplicant] = useState<ApplicantRowLite | null>(null);
  const [composerPrefill, setComposerPrefill] = useState<{ address?: string; city?: string }>({});

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

  async function loadApplicantsPage(cursor?: string | null, resetPaging?: boolean, limitOverride?: number) {
    setLoading(true);
    try {
      const page = await (api as any).getApplicantsPage({
        limit: limitOverride || pageSize,
        cursor: cursor || undefined,
        query: query.trim() || undefined,
        pipeline,
        role: roleFilter === "All" ? undefined : roleFilter,
        gender: genderFilter === "All" ? undefined : genderFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortKey,
        sortDir,
      });

      const items = page?.items || [];
      const next = page?.nextCursor ?? null;

      setRows((items || []).map(normalizeListItem).filter((x: any) => !!x.id));
      setNextCursor(next);
      setTotalMatches(Number.isFinite(Number(page?.count)) ? Number(page.count) : null);
      setRoleOptions(Array.isArray(page?.roleOptions) ? page.roleOptions : []);
      setGenderOptions(Array.isArray(page?.genderOptions) ? page.genderOptions : []);

      if (resetPaging) {
        setCursorStack([]);
        setPageIndex(0);
      }
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Failed to load applicants", classes: "red" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const delay = query.trim() ? 300 : 0;
    const id = window.setTimeout(() => loadApplicantsPage(null, true), delay);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, pipeline, roleFilter, genderFilter, dateFrom, dateTo, sortKey, sortDir, pageSize]);

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
                : `${totalMatches ?? kpis.total} matching applicants • ${filtered.length} shown • Page ${pageIndex + 1}`}
            </p>
          </div>

          <div className="col s12 m4 right-align" style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button
              className={`btn fg-btn ${loading ? "disabled" : ""}`}
              onClick={() => loadApplicantsPage(cursorStack[pageIndex - 1] || null, pageIndex === 0)}
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
                <div className="k">Page size</div>
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

        {/* Pagination controls */}
        <div className="fg-card" style={{ marginTop: 14 }}>
          <div className="fg-card-b" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div className="grey-text" style={{ fontWeight: 900 }}>
              Page <b>{pageIndex + 1}</b> • Showing <b>{rows.length}</b> items (API page)
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className={`btn-small grey darken-2 fg-btn ${pageIndex === 0 || loading ? "disabled" : ""}`}
                disabled={pageIndex === 0 || loading}
                onClick={() => {
                  const prevCursor = cursorStack[pageIndex - 1] || null;
                  setPageIndex((p) => Math.max(0, p - 1));
                  loadApplicantsPage(prevCursor, false);
                }}
              >
                <i className="material-icons left">chevron_left</i>Prev
              </button>

              <button
                className={`btn-small fg-btn ${!nextCursor || loading ? "disabled" : ""}`}
                disabled={!nextCursor || loading}
                onClick={() => {
                  const currentCursor = cursorStack[pageIndex] || null;
                  const newStack = [...cursorStack];
                  newStack[pageIndex] = currentCursor || "";
                  newStack[pageIndex + 1] = nextCursor || "";
                  setCursorStack(newStack);
                  setPageIndex((p) => p + 1);
                  loadApplicantsPage(nextCursor, false);
                }}
              >
                Next<i className="material-icons right">chevron_right</i>
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="fg-card" style={{ marginTop: 14 }}>
          <div className="fg-card-b">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 1100, fontSize: 18 }}>Applicant List</div>
              <div className="grey-text" style={{ fontWeight: 900, fontSize: 12 }}>
                Composer is available inside <b>Details</b> only.
              </div>
            </div>

            <table className="highlight responsive-table" style={{ marginTop: 10 }}>
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
                {loading && (
                  <tr>
                    <td colSpan={7} className="center grey-text">Loading…</td>
                  </tr>
                )}

                {!loading &&
                  filtered.map((r) => {
                    const stageGuess = guessStageFromStatus(r.status);
                    return (
                      <tr key={r.id} className="fg-row">
                        <td><b style={{ fontWeight: 1100 }}>{r.name || "—"}</b></td>
                        <td><code>{r.email || "—"}</code></td>
                        <td>
                          <div style={{ fontWeight: 1000 }}>{r.roleTitle || "—"}</div>
                          {r.roleId ? <div className="grey-text" style={{ fontSize: 12 }}>{r.roleId}</div> : null}
                        </td>
                        <td className="grey-text" style={{ fontWeight: 900 }}>{r.gender || "—"}</td>
                        <td><StatusPill status={r.status || "—"} stageGuess={stageGuess} /></td>
                        <td className="grey-text" style={{ whiteSpace: "nowrap", fontWeight: 900 }}>
                          {fmtDate(r.submittedAt || r.createdAt)}
                        </td>
                        <td className="right-align" style={{ minWidth: 160 }}>
                          <button className="btn-small grey darken-2 fg-btn" onClick={() => onView(r)}>
                            <i className="material-icons left">visibility</i>View
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                {!loading && !filtered.length && (
                  <tr>
                    <td colSpan={7} className="center grey-text">No applicants found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ✅ DETAILS MODAL (new component) */}
      <ApplicantDetailsModal
        open={detailsOpen}
        loading={detailsLoading}
        detailsRaw={detailsRaw}
        onClose={closeDetails}
        onOpenComposer={(lite, prefill) => {
          setComposerApplicant(lite);
          setComposerPrefill(prefill || {});
          setDetailsOpen(false);
          window.setTimeout(() => setComposerOpen(true), 160);
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
    </>
  );
}
