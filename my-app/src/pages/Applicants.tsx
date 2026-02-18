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
  Introduction: { bg: "#f7d699", border: "#ffbc6f", fg: "#8a641e" },
  "Technical Interview": { bg: "#E3EEFF", border: "#94BFFF", fg: "#163A8A" },
  Confirmation: { bg: "#F2E8FF", border: "#CFA7FF", fg: "#4B1E8B" },
  NDA: { bg: "#E8E8FF", border: "#A7A6FF", fg: "#2B2B8A" },
  Offer: { bg: "#E6FAFF", border: "#86DFF5", fg: "#0B4B5A" },
  Welcome: { bg: "#E9F9EF", border: "#9FE0B5", fg: "#14532D" },
};

function StatusPill({ status, stageGuess }: { status: string; stageGuess: Stage | "Unknown" }) {
  const s = safeStr(status) || "—";
  const stg: Stage = stageGuess === "Unknown" ? "Introduction" : (stageGuess as Stage);
  const css = STAGE_BADGE[stg];

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
  status: string;
  submittedAt: string;
  createdAt: string;
  raw: ApiApplicantListItem;
};

function normalizeListItem(a: ApiApplicantListItem): ApplicantRow {
  const payload = (a as any).payload || {};
  const roleId = safeStr((a as any).roleId || payload?.role?.id || payload?.answers?.roleId);

  return {
    id: safeStr((a as any).applicant_id || (a as any).id || (a as any).applicantId),
    name: safeStr((a as any).fullName || payload?.applicant?.fullName),
    email: safeStr((a as any).email || payload?.applicant?.email),
    roleTitle: safeStr((a as any).roleTitle || payload?.role?.title || payload?.answers?.roleTitle),
    roleId,
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

  const [pageSize, setPageSize] = useState<number>(25);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState<number>(0);

  // filters
  const [pipeline, setPipeline] = useState<PipelineFilter>("Active");
  const [filterStage, setFilterStage] = useState<Stage | "All">("All");
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
    `}</style>
  );

  function passesPipeline(r: ApplicantRow) {
    const stageGuess = guessStageFromStatus(r.status);
    if (pipeline === "All") return true;
    if (pipeline === "Rejected") return stageGuess === "Reject";
    if (pipeline === "Converted") return stageGuess === "Welcome";
    return stageGuess !== "Reject" && stageGuess !== "Welcome";
  }

  function passesStage(r: ApplicantRow) {
    if (filterStage === "All") return true;
    const stageGuess = guessStageFromStatus(r.status);
    return stageGuess === filterStage;
  }

  function passesDateRange(r: ApplicantRow) {
    if (!dateFrom && !dateTo) return true;
    const d = parseDateSafe(r.submittedAt) || parseDateSafe(r.createdAt);
    if (!d) return true;

    if (dateFrom) {
      const from = new Date(dateFrom + "T00:00:00");
      if (!Number.isNaN(from.getTime()) && d < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59");
      if (!Number.isNaN(to.getTime()) && d > to) return false;
    }
    return true;
  }

  function applySort(list: ApplicantRow[]) {
    const dir = sortDir === "asc" ? 1 : -1;
    const getSubmitted = (r: ApplicantRow) => {
      const d = parseDateSafe(r.submittedAt) || parseDateSafe(r.createdAt);
      return d ? d.getTime() : 0;
    };
    const cmp = (a: ApplicantRow, b: ApplicantRow) => {
      if (sortKey === "submitted") return (getSubmitted(a) - getSubmitted(b)) * dir;
      if (sortKey === "name") return safeStr(a.name).localeCompare(safeStr(b.name)) * dir;
      if (sortKey === "role") return safeStr(a.roleTitle).localeCompare(safeStr(b.roleTitle)) * dir;
      return safeStr(a.status).localeCompare(safeStr(b.status)) * dir;
    };
    return [...list].sort(cmp);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = rows
      .filter((r) => {
        if (!q) return true;
        return (
          (r.name || "").toLowerCase().includes(q) ||
          (r.email || "").toLowerCase().includes(q) ||
          (r.roleTitle || "").toLowerCase().includes(q) ||
          (r.status || "").toLowerCase().includes(q)
        );
      })
      .filter(passesPipeline)
      .filter(passesStage)
      .filter(passesDateRange);

    return applySort(base);
  }, [rows, query, pipeline, filterStage, dateFrom, dateTo, sortKey, sortDir]);

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

  async function loadApplicantsPage(cursor?: string | null, resetPaging?: boolean) {
    setLoading(true);
    try {
      const page = await (api as any).getApplicantsPage?.({
        limit: pageSize,
        cursor: cursor || undefined,
      });

      const items = page?.items || (await api.getApplicants());
      const next = page?.nextCursor ?? null;

      setRows((items || []).map(normalizeListItem).filter((x: any) => !!x.id));
      setNextCursor(next);

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
    loadApplicantsPage(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              {loading ? "Loading…" : `${kpis.total} on this page • ${filtered.length} shown • Page ${pageIndex + 1}`}
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
                        setTimeout(() => loadApplicantsPage(null, true), 0);
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
                Tip: Click table headers to sort (triangle).
              </div>
            </div>

            <div className="row" style={{ marginBottom: 0, marginTop: 6 }}>
              <div className="input-field col s12 m5">
                <input
                  id="searchApplicants"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, email, role, status…"
                />
                <label htmlFor="searchApplicants" className="active">Search</label>
              </div>

              <div className="input-field col s12 m3">
                <select className="browser-default" value={pipeline} onChange={(e) => setPipeline(e.target.value as any)}>
                  <option value="Active">Active pipeline</option>
                  <option value="All">All</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Converted">Converted (Welcome)</option>
                </select>
                <label className="active" style={{ position: "relative", top: -24 }}>Pipeline</label>
              </div>

              <div className="input-field col s12 m4">
                <select className="browser-default" value={filterStage} onChange={(e) => setFilterStage(e.target.value as any)}>
                  <option value="All">All stages</option>
                  {(["Introduction","Technical Interview","Confirmation","Reject","NDA","Offer","Welcome"] as Stage[]).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <label className="active" style={{ position: "relative", top: -24 }}>Stage</label>
              </div>
            </div>

            <div className="row" style={{ marginBottom: 0 }}>
              <div className="col s12 m3" style={{ marginTop: 6 }}>
                <div className="grey-text" style={{ fontWeight: 1000, marginBottom: 6 }}>Submitted from</div>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>

              <div className="col s12 m3" style={{ marginTop: 6 }}>
                <div className="grey-text" style={{ fontWeight: 1000, marginBottom: 6 }}>Submitted to</div>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>

              <div className="col s12 m6" style={{ marginTop: 10, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button
                  className="btn-flat"
                  onClick={() => {
                    setQuery("");
                    setPipeline("Active");
                    setFilterStage("All");
                    setDateFrom("");
                    setDateTo("");
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
                  <th className="fg-th" onClick={() => toggleSort("status")}>Status {sortTriangle(sortKey === "status", sortDir)}</th>
                  <th className="fg-th" onClick={() => toggleSort("submitted")}>Submitted {sortTriangle(sortKey === "submitted", sortDir)}</th>
                  <th className="right-align">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="center grey-text">Loading…</td>
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
                    <td colSpan={6} className="center grey-text">No applicants found.</td>
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
        onClose={() => setDetailsOpen(false)}
        onOpenComposer={(lite, prefill) => {
          setComposerApplicant(lite);
          setComposerPrefill(prefill || {});
          setComposerOpen(true);
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
