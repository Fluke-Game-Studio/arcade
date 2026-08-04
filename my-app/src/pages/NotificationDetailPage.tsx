import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import FgcAmount from "../components/credits/FgcAmount";
import type { ApiNotificationItem } from "../api";
import { notificationChips, notificationIcon, notificationIconChipStyle, notificationIconStyle, notificationLabel, notificationOpenHref, notificationTone } from "../lib/notifications";

const META_LABELS: Record<string, string> = {
  channels: "Channels",
  weekStart: "Week",
  projectId: "Project",
  amount_cents: "Amount",
  total_cents: "Total",
  order_id: "Order ID",
  item: "Item",
  quantity: "Quantity",
  reason: "Reason",
  rating: "Rating",
  actorName: "Rated by",
  email: "Email",
  decision: "Decision",
  comment: "Comment",
  scheduledAt: "Scheduled",
  publishedAt: "Published at",
};

function formatMetaValue(key: string, value: unknown) {
  if (Array.isArray(value)) return value.map((v) => safeStr(v)).filter(Boolean).join(", ");
  if ((key === "amount_cents" || key === "total_cents") && safeStr(value)) {
    return <FgcAmount amount={Number(value)} style={{ fontWeight: 800, color: "#0f172a" }} iconSize={30} />;
  }
  if (key === "decision") return safeStr(value) === "approved" ? "Approved" : safeStr(value) === "rejected" ? "Rejected" : safeStr(value);
  return safeStr(value);
}

declare const M: any;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function fmtDate(value?: string) {
  if (!value) return "Unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function NotificationDetailPage() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const notificationId = safeStr(params.notificationId);
  const [item, setItem] = useState<ApiNotificationItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        if (!notificationId) throw new Error("Missing notification id");
        const resp = await api.getNotificationDetail(notificationId);
        if (!mounted) return;
        setItem(resp?.notification || null);
        if (resp?.notification?.notificationId && !resp.notification.read) {
          await api.markNotificationsRead({ notificationId: resp.notification.notificationId }).catch(() => null);
        }
      } catch (e: any) {
        if (mounted) {
          setItem(null);
          M?.toast?.({ html: e?.message || "Failed to load notification", classes: "red" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [api, notificationId]);

  const tone = useMemo(() => notificationTone(item?.category), [item?.category]);
  const chips = useMemo(() => notificationChips(item || {}), [item]);
  const targetHref = useMemo(() => (item ? notificationOpenHref(item) : "/"), [item]);
  const metaEntries = useMemo(() => {
    const meta = item?.meta && typeof item.meta === "object" ? item.meta : {};
    return Object.entries(meta)
      .map(([key, value]) => ({ key, label: META_LABELS[key] || "", value: formatMetaValue(key, value) }))
      .filter((row) => row.label && row.value);
  }, [item]);

  return (
    <main className="container" style={{ paddingTop: 24, maxWidth: 1120 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <Link to="/account/notifications" style={{ color: "#1d4ed8", fontWeight: 900, textDecoration: "none" }}>
          Back to notifications
        </Link>
        {item?.href ? (
          <button type="button" className="btn-flat" onClick={() => navigate(targetHref)}>
            Open related item
          </button>
        ) : null}
      </div>

      <section
        style={{
          borderRadius: 26,
          border: "1px solid rgba(148,163,184,.18)",
          background: "linear-gradient(180deg,#fff,#f8fafc)",
          boxShadow: "0 20px 50px rgba(15,23,42,.08)",
          padding: 22,
          display: "grid",
          gap: 16,
        }}
      >
        {loading ? (
          <div style={{ color: "#64748b", fontWeight: 700, padding: 12 }}>Loading notification...</div>
        ) : item ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <span
                  style={{
                    background: tone.chip,
                    color: tone.text,
                    boxShadow: `0 0 0 6px ${tone.chip}`,
                    ...notificationIconChipStyle,
                    width: 52,
                    height: 52,
                    borderRadius: 18,
                  }}
                >
                  <i className="material-icons" style={{ fontSize: 28, ...notificationIconStyle }}>{notificationIcon(item.type, item.category, item.meta)}</i>
                </span>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 1000, color: "#0f172a" }}>{item.title || "Notification"}</div>
                  <div style={{ color: "#64748b", fontWeight: 700, marginTop: 4 }}>
                    {notificationLabel(item)} · {fmtDate(item.createdAt)}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Status</div>
                <div style={{ fontSize: 16, fontWeight: 1000, color: item.read ? "#166534" : "#b45309" }}>
                  {item.read ? "Read" : "Unread"}
                </div>
              </div>
            </div>

            <div style={{ color: "#334155", fontSize: 15, lineHeight: 1.7, fontWeight: 700 }}>
              {item.body || "No message body available."}
            </div>

            {chips.length ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {chips.map((chip) => (
                  <span
                    key={chip.key}
                    style={{
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,.18)",
                      background: "rgba(248,250,252,.95)",
                      color: "#475569",
                      padding: "6px 10px",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div style={{ border: "1px solid #e6edf2", borderRadius: 16, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Notification ID</div>
                <div style={{ fontWeight: 800, color: "#0f172a", marginTop: 6, wordBreak: "break-word" }}>{item.notificationId || "-"}</div>
              </div>
              <div style={{ border: "1px solid #e6edf2", borderRadius: 16, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Recipient</div>
                <div style={{ fontWeight: 800, color: "#0f172a", marginTop: 6, wordBreak: "break-word" }}>{item.recipientUsername || "-"}</div>
              </div>
              <div style={{ border: "1px solid #e6edf2", borderRadius: 16, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Entity</div>
                <div style={{ fontWeight: 800, color: "#0f172a", marginTop: 6, wordBreak: "break-word" }}>
                  {item.entityType || "-"} {item.entityId ? `· ${item.entityId}` : ""}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {item.href ? (
                <button type="button" className="btn" onClick={() => navigate(targetHref)}>
                  Open Related Page
                </button>
              ) : null}
              <button type="button" className="btn-flat" onClick={() => navigate("/account/notifications")}>
                Back to List
              </button>
            </div>

            {metaEntries.length ? (
              <div style={{ border: "1px solid #e6edf2", borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 10 }}>Details</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {metaEntries.map((row) => (
                    <div key={row.key} style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <span style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>{row.label}</span>
                      <span style={{ color: "#0f172a", fontWeight: 800, fontSize: 13, textAlign: "right", wordBreak: "break-word" }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="emptyState">Notification not found.</div>
        )}
      </section>
    </main>
  );
}
