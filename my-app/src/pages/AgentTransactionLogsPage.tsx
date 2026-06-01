import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api/config";
import { useAuth } from "../auth/AuthContext";

type RunRow = {
  runId: string;
  createdAt: string;
  username: string;
  callerRole: string;
  agentId: string;
  mode: string;
  actionName: string;
  status: string;
  deniedReason: string;
  requestQuestion: string;
  replySummary: string;
  isActionMcp?: boolean;
  actionMcp?: Record<string, any> | null;
  workflow?: Record<string, any> | null;
  approval?: Record<string, any> | null;
  guardrails?: Record<string, any> | null;
  errorPayload?: Record<string, any> | null;
  resultPayload?: Record<string, any> | null;
};

const ACTIONS = [
  "",
  "send_email",
  "upsert_job",
  "submit_weekly_update",
  "search_jira_issues",
  "get_issue_details",
  "transition_issue",
  "add_comment",
];

const STATUSES = ["", "done", "needs_approval", "denied", "error"];

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function fmtDate(value = "") {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return value || "-";
  return new Date(t).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function jsonBlock(value: any) {
  if (!value) return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return safeStr(value);
  }
}

function statusClass(status = "") {
  const s = safeStr(status).toLowerCase();
  if (s === "done") return "txn-pill txn-pill-ok";
  if (s === "needs_approval") return "txn-pill txn-pill-warn";
  if (s === "denied" || s === "error") return "txn-pill txn-pill-bad";
  return "txn-pill";
}

type AgentTransactionLogsPageProps = {
  embedded?: boolean;
};

export default function AgentTransactionLogsPage({ embedded = false }: AgentTransactionLogsPageProps) {
  const { user } = useAuth() as any;
  const token = safeStr(user?.token);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedRun, setSelectedRun] = useState<RunRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [mcpOnly, setMcpOnly] = useState(true);
  const [status, setStatus] = useState("");
  const [actionName, setActionName] = useState("");
  const [username, setUsername] = useState("");
  const [limit, setLimit] = useState(75);

  const selectedFromList = useMemo(
    () => runs.find((x) => x.runId === selectedRunId) || null,
    [runs, selectedRunId]
  );

  async function loadRuns() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        limit: String(limit),
        mcpOnly: String(mcpOnly),
      });
      if (status) qs.set("status", status);
      if (actionName) qs.set("actionName", actionName);
      if (username.trim()) qs.set("username", username.trim());

      const resp = await fetch(`${API_BASE}/admin/ai/runs?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const backendError = safeStr(data?.error);
        if (backendError === "missing-runId") {
          throw new Error(
            "The page is live, but the deployed ue-auth Lambda still has the old /admin/ai/runs endpoint. Deploy the updated ue-auth backend so recent transaction listing is enabled."
          );
        }
        throw new Error(backendError || `HTTP ${resp.status}`);
      }
      const nextRuns = Array.isArray(data?.runs) ? data.runs : [];
      setRuns(nextRuns);
      if (!selectedRunId && nextRuns[0]?.runId) setSelectedRunId(nextRuns[0].runId);
    } catch (err: any) {
      setError(safeStr(err?.message || "Failed to load AI transaction logs."));
    } finally {
      setLoading(false);
    }
  }

  async function loadRunDetail(runId: string) {
    if (!token || !runId) return;
    setDetailLoading(true);
    setError("");
    try {
      const resp = await fetch(`${API_BASE}/admin/ai/runs?runId=${encodeURIComponent(runId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(safeStr(data?.error || `HTTP ${resp.status}`));
      setSelectedRun(data?.run || null);
    } catch (err: any) {
      setError(safeStr(err?.message || "Failed to load run details."));
      setSelectedRun(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (selectedRunId) loadRunDetail(selectedRunId);
    else setSelectedRun(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId, token]);

  const detail = selectedRun || selectedFromList;
  const actionMcp = detail?.actionMcp || detail?.resultPayload?.meta?.actionMcp || null;
  const workflow = detail?.workflow || detail?.resultPayload?.meta?.workflow || null;
  const approval = detail?.approval || detail?.resultPayload?.meta?.approval || null;
  const guardrails = detail?.guardrails || detail?.resultPayload?.meta?.guardrails || null;

  const content = (
    <>
      {!embedded ? (
        <section className="txn-hero">
          <div>
            <p className="txn-kicker">AI Governance</p>
            <h1>Agent Transaction Logs</h1>
            <p>
              Review AI runs, MCP actions, approvals, denials, request payloads, backend routes,
              and execution traces from the persisted run log table.
            </p>
          </div>
          <button className="txn-btn primary" onClick={loadRuns} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </section>
      ) : (
        <section className="txn-embedded-head">
          <div>
            <p className="txn-kicker">AI Governance</p>
            <h2>Transaction History</h2>
            <p>Review MCP executions, approvals, guardrails, backend routes, and run payloads.</p>
          </div>
          <button className="txn-btn primary" onClick={loadRuns} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </section>
      )}

      <section className="txn-filters" aria-label="Transaction filters">
        <label>
          <span>MCP only</span>
          <input type="checkbox" checked={mcpOnly} onChange={(e) => setMcpOnly(e.target.checked)} />
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((x) => (
              <option key={x || "all"} value={x}>{x || "All statuses"}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Action</span>
          <select value={actionName} onChange={(e) => setActionName(e.target.value)}>
            {ACTIONS.map((x) => (
              <option key={x || "all"} value={x}>{x || "All actions"}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="optional" />
        </label>
        <label>
          <span>Limit</span>
          <input
            type="number"
            min={1}
            max={250}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value || 75))}
          />
        </label>
        <button className="txn-btn" onClick={loadRuns} disabled={loading}>Apply</button>
      </section>

      {error && <div className="txn-error">{error}</div>}

      <section className="txn-grid">
        <div className="txn-card txn-list">
          <div className="txn-card-head">
            <h2>Recent Runs</h2>
            <span>{runs.length} shown</span>
          </div>
          <div className="txn-table" role="list">
            {runs.map((run) => (
              <button
                key={run.runId}
                className={`txn-row ${selectedRunId === run.runId ? "active" : ""}`}
                onClick={() => setSelectedRunId(run.runId)}
              >
                <span className="txn-row-main">
                  <b>{safeStr(run.actionName) || "ai_response"}</b>
                  <small>{safeStr(run.agentId) || "no-agent"} | {safeStr(run.username) || "unknown"}</small>
                </span>
                <span className={statusClass(run.status)}>{safeStr(run.status) || "-"}</span>
                <span className="txn-date">{fmtDate(run.createdAt)}</span>
              </button>
            ))}
            {!runs.length && !loading && (
              <div className="txn-empty">No transaction logs matched the current filters.</div>
            )}
          </div>
        </div>

        <div className="txn-card txn-detail">
          <div className="txn-card-head">
            <h2>Run Details</h2>
            <span>{detailLoading ? "Loading..." : safeStr(detail?.runId) || "No run selected"}</span>
          </div>

          {detail ? (
            <>
              <div className="txn-summary">
                <div><span>Status</span><b className={statusClass(detail.status)}>{safeStr(detail.status) || "-"}</b></div>
                <div><span>Action</span><b>{safeStr(detail.actionName) || "ai_response"}</b></div>
                <div><span>User</span><b>{safeStr(detail.username) || "-"}</b></div>
                <div><span>Agent</span><b>{safeStr(detail.agentId) || "-"}</b></div>
                <div><span>Role</span><b>{safeStr(detail.callerRole) || "-"}</b></div>
                <div><span>Created</span><b>{fmtDate(detail.createdAt)}</b></div>
              </div>

              <section className="txn-panel">
                <h3>Request</h3>
                <p>{safeStr(detail.requestQuestion) || "-"}</p>
              </section>

              <section className="txn-panel">
                <h3>Action MCP</h3>
                {actionMcp ? (
                  <div className="txn-action-grid">
                    <div><span>Action</span><b>{safeStr(actionMcp.action) || "-"}</b></div>
                    <div><span>Route</span><b>{safeStr(actionMcp.route) || "-"}</b></div>
                    <div><span>Result</span><b>{actionMcp.ok === true ? "ok" : "not ok"}</b></div>
                  </div>
                ) : (
                  <p>No Action MCP call was recorded for this run.</p>
                )}
              </section>

              <section className="txn-panel">
                <h3>Approval / Guardrails</h3>
                <pre>{jsonBlock({ approval, guardrails, deniedReason: detail.deniedReason })}</pre>
              </section>

              <section className="txn-panel">
                <h3>MCP Request Payload</h3>
                <pre>{jsonBlock(actionMcp?.request)}</pre>
              </section>

              <section className="txn-panel">
                <h3>MCP Response</h3>
                <pre>{jsonBlock(actionMcp?.response)}</pre>
              </section>

              <section className="txn-panel">
                <h3>Workflow Trace</h3>
                <pre>{jsonBlock(workflow)}</pre>
              </section>

              <section className="txn-panel">
                <h3>Full Result Payload</h3>
                <pre>{jsonBlock(detail.resultPayload)}</pre>
              </section>
            </>
          ) : (
            <div className="txn-empty">Select a run to inspect the transaction details.</div>
          )}
        </div>
      </section>

      <style>{`
        .txn-wrap { max-width: 1280px; margin: 0 auto; padding: 18px 14px 30px; color: #0f172a; }
        .txn-wrap.embedded { max-width: none; margin: 12px 0 0; padding: 0; }
        .txn-hero {
          display: flex; justify-content: space-between; gap: 16px; align-items: flex-start;
          border: 1px solid rgba(37,99,235,0.2); background: linear-gradient(180deg, #ffffff, #eff6ff);
          border-radius: 14px; padding: 18px; box-shadow: 0 10px 28px rgba(15,23,42,0.08);
        }
        .txn-embedded-head {
          display: flex; justify-content: space-between; gap: 16px; align-items: flex-start;
          border: 1px solid rgba(148,163,184,0.18); background: rgba(15,23,42,0.48);
          border-radius: 14px; padding: 14px; color: #e2e8f0;
        }
        .txn-kicker { margin: 0 0 4px; color: #2563eb; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; font-size: 12px; }
        .txn-embedded-head .txn-kicker { color: #93c5fd; }
        .txn-hero h1 { margin: 0; font-size: 28px; line-height: 1.05; color: #0f172a; }
        .txn-embedded-head h2 { margin: 0; font-size: 20px; line-height: 1.1; color: #e2e8f0; }
        .txn-hero p { margin: 8px 0 0; color: #475569; max-width: 820px; line-height: 1.5; }
        .txn-embedded-head p { margin: 7px 0 0; color: rgba(191,219,254,0.9); max-width: 820px; line-height: 1.5; }
        .txn-filters {
          display: grid; grid-template-columns: 120px minmax(130px, 1fr) minmax(180px, 1fr) minmax(150px, 1fr) 100px auto;
          gap: 10px; align-items: end; margin-top: 12px;
        }
        .txn-filters label { display: grid; gap: 5px; color: #475569; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
        .txn-filters input, .txn-filters select {
          min-height: 40px; border-radius: 8px; border: 1px solid rgba(148,163,184,0.55);
          padding: 0 10px; background: #fff; color: #0f172a; font: inherit;
        }
        .txn-filters label:first-child { display: flex; align-items: center; gap: 8px; min-height: 40px; }
        .txn-filters label:first-child input { min-height: auto; width: 18px; height: 18px; }
        .txn-btn {
          min-height: 40px; border: 1px solid rgba(37,99,235,0.35); background: #fff; color: #1d4ed8;
          border-radius: 8px; padding: 0 14px; font-weight: 900; cursor: pointer;
        }
        .txn-btn.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
        .txn-btn:disabled { opacity: 0.58; cursor: not-allowed; }
        .txn-error { margin-top: 12px; border: 1px solid rgba(220,38,38,0.25); background: #fef2f2; color: #991b1b; border-radius: 10px; padding: 10px 12px; font-weight: 800; }
        .txn-grid { display: grid; grid-template-columns: minmax(360px, 0.8fr) minmax(0, 1.45fr); gap: 12px; margin-top: 12px; align-items: start; }
        .txn-card { border: 1px solid rgba(148,163,184,0.35); border-radius: 12px; background: #fff; box-shadow: 0 8px 24px rgba(15,23,42,0.06); overflow: hidden; }
        .txn-card-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 12px 14px; border-bottom: 1px solid rgba(148,163,184,0.25); background: #f8fafc; }
        .txn-card-head h2 { margin: 0; font-size: 16px; color: #0f172a; }
        .txn-card-head span { color: #64748b; font-size: 12px; font-weight: 800; word-break: break-all; }
        .txn-table { max-height: 72vh; overflow: auto; }
        .txn-row { width: 100%; border: 0; border-bottom: 1px solid rgba(226,232,240,0.95); background: #fff; padding: 10px 12px; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; text-align: left; cursor: pointer; color: #0f172a; }
        .txn-row:hover, .txn-row.active { background: #eff6ff; }
        .txn-row-main { min-width: 0; display: grid; gap: 2px; }
        .txn-row-main b { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .txn-row-main small { color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .txn-date { color: #64748b; font-size: 12px; white-space: nowrap; }
        .txn-pill { display: inline-flex; align-items: center; justify-content: center; min-height: 24px; border-radius: 999px; padding: 0 9px; font-size: 11px; font-weight: 900; color: #334155; background: #f1f5f9; border: 1px solid rgba(148,163,184,0.35); white-space: nowrap; }
        .txn-pill-ok { color: #047857; background: #ecfdf5; border-color: rgba(16,185,129,0.28); }
        .txn-pill-warn { color: #92400e; background: #fffbeb; border-color: rgba(245,158,11,0.32); }
        .txn-pill-bad { color: #b91c1c; background: #fef2f2; border-color: rgba(239,68,68,0.3); }
        .txn-detail { max-height: 78vh; overflow: auto; }
        .txn-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 12px; }
        .txn-summary div, .txn-action-grid div { border: 1px solid rgba(226,232,240,0.95); border-radius: 8px; padding: 9px; background: #f8fafc; display: grid; gap: 4px; min-width: 0; }
        .txn-summary span, .txn-action-grid span { color: #64748b; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; }
        .txn-summary b, .txn-action-grid b { color: #0f172a; font-size: 13px; overflow-wrap: anywhere; }
        .txn-panel { border-top: 1px solid rgba(226,232,240,0.95); padding: 12px; }
        .txn-panel h3 { margin: 0 0 8px; font-size: 14px; color: #0f172a; }
        .txn-panel p { margin: 0; color: #334155; line-height: 1.5; }
        .txn-panel pre { margin: 0; max-height: 280px; overflow: auto; white-space: pre-wrap; word-break: break-word; border: 1px solid rgba(148,163,184,0.25); background: #0f172a; color: #dbeafe; border-radius: 8px; padding: 10px; font-size: 12px; line-height: 1.45; }
        .txn-action-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .txn-empty { color: #64748b; padding: 18px; text-align: center; font-weight: 800; }
        @media (max-width: 980px) {
          .txn-hero { display: grid; }
          .txn-filters { grid-template-columns: 1fr 1fr; }
          .txn-grid { grid-template-columns: 1fr; }
          .txn-detail { max-height: none; }
        }
        @media (max-width: 640px) {
          .txn-filters, .txn-summary, .txn-action-grid { grid-template-columns: 1fr; }
          .txn-row { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
    </>
  );

  if (embedded) return <div className="txn-wrap embedded">{content}</div>;
  return <main className="txn-wrap">{content}</main>;
}
