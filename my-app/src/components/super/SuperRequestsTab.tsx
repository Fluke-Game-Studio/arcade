import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import type { ApiRequestRecord } from "../../api";

declare const M: any;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function fmtDate(value?: string) {
  if (!value) return "Unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function SuperRequestsTab() {
  const { api } = useAuth();
  const [requests, setRequests] = useState<ApiRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const merchRequests = useMemo(
    () =>
      requests.filter((request) => {
        const kind = safeStr(request.kind || request.requestType || "").toLowerCase();
        return kind.startsWith("store_");
      }),
    [requests]
  );

  async function loadRequests() {
    setLoading(true);
    try {
      const resp = await api.listRequests({
        status: statusFilter,
        limit: 200,
      });
      const nextRequests = Array.isArray(resp?.requests) ? resp.requests : [];
      setRequests(
        nextRequests.filter((request) => {
          const kind = safeStr(request.kind || request.requestType || "").toLowerCase();
          return kind.startsWith("store_");
        })
      );
    } catch (err: any) {
      M?.toast?.({ html: err?.message || "Failed to load requests", classes: "red" });
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function reviewRequest(request: ApiRequestRecord, decision: "approved" | "rejected") {
    setReviewingId(request.requestId);
    try {
      await api.reviewRequest({
        requestId: request.requestId,
        decision,
        reviewNote: safeStr(reviewNotes[request.requestId]),
      });
      M?.toast?.({ html: `Request ${decision}`, classes: "green" });
      await loadRequests();
    } catch (err: any) {
      M?.toast?.({ html: err?.message || "Failed to review request", classes: "red" });
    } finally {
      setReviewingId("");
    }
  }

  return (
    <div className="suCard">
      <div className="card-content">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>Merch Requests</div>
            <div style={{ color: "#475569" }}>Only store merch requests live here. Agent Builder requests stay in Agent Builder &gt; Requests.</div>
          </div>
          <button type="button" className="btn-flat" onClick={() => void loadRequests()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {["pending", "approved", "rejected", "all"].map((x) => (
            <button
              key={x}
              type="button"
              className="btn-flat"
              onClick={() => setStatusFilter(x)}
              style={{
                fontWeight: 900,
                border: statusFilter === x ? "1px solid rgba(59,130,246,.35)" : undefined,
                background: statusFilter === x ? "rgba(59,130,246,.10)" : undefined,
              }}
            >
              {x === "all" ? "All Statuses" : x.charAt(0).toUpperCase() + x.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {merchRequests.length ? merchRequests.map((request) => {
            const kind = safeStr(request.kind || request.requestType || "generic").toLowerCase();
            const pending = safeStr(request.status).toLowerCase() === "pending";
            return (
              <article
                key={request.requestId}
                style={{
                  border: "1px solid #e6edf2",
                  borderRadius: 18,
                  background: "#fff",
                  padding: 14,
                  boxShadow: "0 10px 24px rgba(15,23,42,.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 1000, color: "#0f172a", fontSize: 16 }}>{request.title || request.kind}</div>
                    <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                      {kind.replace(/_/g, " ")} · {request.username || "unknown"} · {fmtDate(request.createdAt)}
                    </div>
                  </div>
                  <div style={{
                    fontWeight: 1000,
                    textTransform: "uppercase",
                    fontSize: 12,
                    color: pending ? "#92400e" : request.status === "approved" ? "#166534" : "#991b1b",
                    background: pending ? "#fef3c7" : request.status === "approved" ? "#dcfce7" : "#fee2e2",
                    borderRadius: 999,
                    padding: "6px 10px",
                    height: "fit-content",
                  }}>
                    {request.status || "pending"}
                  </div>
                </div>

                {request.summary ? (
                  <div style={{ marginTop: 10, color: "#334155", fontSize: 13 }}>{request.summary}</div>
                ) : null}

                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {request.agentId ? <div style={{ fontSize: 13, color: "#475569" }}><b>Agent:</b> {request.agentId}</div> : null}
                  {request.reason ? <div style={{ fontSize: 13, color: "#475569" }}><b>Reason:</b> {request.reason}</div> : null}
                  <details style={{ border: "1px dashed #dbe5ef", borderRadius: 12, padding: 10, background: "#fbfdff" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 900, color: "#334155" }}>Payload</summary>
                    <pre style={{ marginTop: 10, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, color: "#0f172a" }}>{prettyJson(request.payload || {})}</pre>
                  </details>
                  {request.reviewNote ? (
                    <div style={{ fontSize: 13, color: "#475569" }}><b>Review note:</b> {request.reviewNote}</div>
                  ) : null}
                  {request.reviewedAt ? (
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Reviewed by {request.reviewedBy || "unknown"} at {fmtDate(request.reviewedAt)}
                    </div>
                  ) : null}
                </div>

                {pending ? (
                  <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    <textarea
                      value={reviewNotes[request.requestId] || ""}
                      onChange={(e) => setReviewNotes((prev) => ({ ...prev, [request.requestId]: e.target.value }))}
                      rows={3}
                      placeholder="Optional review note"
                      style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", padding: 10 }}
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn"
                        disabled={reviewingId === request.requestId}
                        onClick={() => void reviewRequest(request, "approved")}
                      >
                        {reviewingId === request.requestId ? "Working..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="btn-flat"
                        disabled={reviewingId === request.requestId}
                        onClick={() => void reviewRequest(request, "rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          }) : (
            <div className="emptyState">{loading ? "Loading requests..." : "No requests found."}</div>
          )}
        </div>
      </div>
    </div>
  );
}
