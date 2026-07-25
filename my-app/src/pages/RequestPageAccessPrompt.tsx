import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

declare const M: any;

type Props = {
  pageKey: string;
  label?: string;
};

export default function RequestPageAccessPrompt({ pageKey, label }: Props) {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [existingStatus, setExistingStatus] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await api.listMyRequests({ kind: "page_access", status: "all", limit: 50 });
        const existing = (resp.requests || [])
          .filter((r) => String(r?.payload?.pageKey || "") === pageKey)
          .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
        if (!cancelled) setExistingStatus(String(existing?.status || ""));
      } catch {
        if (!cancelled) setExistingStatus("");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, pageKey]);

  const pending = existingStatus === "pending";
  const rejected = existingStatus === "rejected";

  const title = useMemo(() => label || pageKey, [label, pageKey]);

  async function submitRequest() {
    setSubmitting(true);
    try {
      await api.createRequest({
        kind: "page_access",
        title: `Page access: ${title}`,
        summary: reason,
        payload: { pageKey },
      });
      setExistingStatus("pending");
      M?.toast?.({ html: "Access request submitted", classes: "green" });
    } catch (err: any) {
      M?.toast?.({ html: err?.message || "Failed to submit request", classes: "red" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "60px auto", padding: 24 }}>
      <div
        style={{
          border: "1px solid #e6edf2",
          borderRadius: 18,
          background: "#fff",
          padding: 24,
          boxShadow: "0 10px 24px rgba(15,23,42,.04)",
        }}
      >
        <div style={{ fontWeight: 1000, fontSize: 18, color: "#0f172a" }}>You don't have access to this page yet</div>
        <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>{title}</div>

        {loading ? (
          <div style={{ marginTop: 16, color: "#64748b" }}>Checking request status...</div>
        ) : pending ? (
          <div style={{ marginTop: 16, color: "#92400e", background: "#fef3c7", borderRadius: 10, padding: 12, fontWeight: 700 }}>
            Your request is pending review.
          </div>
        ) : (
          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            {rejected ? (
              <div style={{ color: "#991b1b", background: "#fee2e2", borderRadius: 10, padding: 12, fontWeight: 700 }}>
                Your previous request was rejected. You can submit a new one below.
              </div>
            ) : null}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why do you need access? (optional)"
              style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", padding: 10 }}
            />
            <button type="button" className="btn" disabled={submitting} onClick={() => void submitRequest()}>
              {submitting ? "Submitting..." : "Request access"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
