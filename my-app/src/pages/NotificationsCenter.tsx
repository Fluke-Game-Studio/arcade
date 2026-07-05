import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

declare const M: any;

type NotificationItem = {
  recipientUsername?: string;
  notificationId?: string;
  type?: string;
  category?: string;
  title?: string;
  body?: string;
  href?: string;
  actorUsername?: string;
  read?: boolean;
  readAt?: string;
  createdAt?: string;
  meta?: Record<string, any>;
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function relativeTime(value?: string) {
  const raw = safeStr(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleString();
}

function categoryTone(category?: string) {
  const value = safeStr(category).toLowerCase();
  if (value === "social_media") return { dot: "#2563eb", chip: "rgba(37,99,235,.12)", text: "#1d4ed8", label: "Social" };
  if (value === "weekly_updates") return { dot: "#0f766e", chip: "rgba(15,118,110,.12)", text: "#0f766e", label: "Weekly" };
  if (value === "applicants") return { dot: "#9333ea", chip: "rgba(147,51,234,.12)", text: "#7e22ce", label: "Applicants" };
  if (value === "mentions") return { dot: "#db2777", chip: "rgba(219,39,119,.12)", text: "#be185d", label: "Mentions" };
  return { dot: "#475569", chip: "rgba(148,163,184,.12)", text: "#475569", label: "System" };
}

function typeIcon(type?: string, category?: string) {
  const value = safeStr(type).toLowerCase();
  const group = safeStr(category).toLowerCase();
  if (value.includes("mention")) return "alternate_email";
  if (value.includes("changes_requested")) return "edit_note";
  if (value.includes("published")) return "campaign";
  if (value.includes("review")) return "rate_review";
  if (group === "weekly_updates") return "event_note";
  if (group === "applicants") return "group_add";
  return "notifications";
}

function renderMetaChips(item: NotificationItem) {
  const meta = item.meta && typeof item.meta === "object" ? item.meta : {};
  const chips: Array<{ key: string; label: string }> = [];
  const channels = Array.isArray(meta.channels) ? meta.channels.map((x) => safeStr(x)).filter(Boolean) : [];
  channels.forEach((channel) => chips.push({ key: `channel-${channel}`, label: channel }));
  if (safeStr(item.actorUsername)) chips.push({ key: "actor", label: safeStr(item.actorUsername) });
  if (safeStr(meta.weekStart)) chips.push({ key: "week", label: `Week ${safeStr(meta.weekStart)}` });
  if (safeStr(meta.projectId)) chips.push({ key: "project", label: safeStr(meta.projectId) });
  if (safeStr(meta.scheduledAt)) chips.push({ key: "scheduled", label: `Scheduled ${safeStr(meta.scheduledAt).replace("T", " ")}` });
  if (safeStr(meta.publishedAt)) chips.push({ key: "published", label: `Published ${safeStr(meta.publishedAt).replace("T", " ")}` });
  return chips;
}

const actionButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,.22)",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 900,
  cursor: "pointer",
};

export default function NotificationsCenter() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory] = useState("all");

  async function load(cursor?: string, append = false) {
    try {
      append ? setLoadingMore(true) : setLoading(true);
      const resp = await api.getNotifications({
        limit: 20,
        cursor,
        unreadOnly,
      });
      const rows = Array.isArray(resp?.items) ? resp.items : [];
      setItems((prev) => (append ? [...prev, ...rows] : rows));
      setNextCursor(safeStr(resp?.nextCursor) || null);
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Failed to load notifications", classes: "red" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void load();
  }, [unreadOnly]);

  const filtered = useMemo(() => {
    if (category === "all") return items;
    return items.filter((item) => safeStr(item.category).toLowerCase() === category);
  }, [category, items]);

  async function openItem(item: NotificationItem) {
    try {
      if (safeStr(item.notificationId) && !item.read) {
        await api.markNotificationsRead({ notificationId: safeStr(item.notificationId) });
        setItems((prev) =>
          prev.map((row) =>
            safeStr(row.notificationId) === safeStr(item.notificationId)
              ? { ...row, read: true }
              : row
          )
        );
      }
    } catch {}
    navigate(safeStr(item.href) || "/");
  }

  async function markAllRead() {
    try {
      await api.markNotificationsRead({ all: true });
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
      M?.toast?.({ html: "All notifications marked as read.", classes: "green" });
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Failed to mark notifications read", classes: "red" });
    }
  }

  return (
    <main className="container" style={{ paddingTop: 22, maxWidth: 1120 }}>
      <section
        style={{
          borderRadius: 28,
          border: "1px solid rgba(148,163,184,.18)",
          background: "linear-gradient(180deg,#fff,#f8fafc)",
          boxShadow: "0 20px 50px rgba(15,23,42,.08)",
          padding: 22,
          display: "grid",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <h2 style={{ margin: 0, fontSize: 32, fontWeight: 1000 }}>Notifications</h2>
            <p style={{ margin: 0, color: "#64748b", fontWeight: 700 }}>
              Review mentions, post review activity, and weekly update alerts in one place.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" style={actionButtonStyle} onClick={() => void load()}>
              <i className="material-icons" style={{ fontSize: 18 }}>refresh</i>
              Refresh
            </button>
            <button type="button" style={actionButtonStyle} onClick={() => void markAllRead()}>
              <i className="material-icons" style={{ fontSize: 18 }}>done_all</i>
              Mark all read
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {[
            { key: "all", label: "All" },
            { key: "social_media", label: "Social" },
            { key: "mentions", label: "Mentions" },
            { key: "weekly_updates", label: "Weekly" },
            { key: "applicants", label: "Applicants" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCategory(tab.key)}
              style={{
                border: "1px solid rgba(148,163,184,.18)",
                borderRadius: 999,
                padding: "10px 16px",
                background: category === tab.key ? "linear-gradient(135deg,#2563eb,#0f766e)" : "#fff",
                color: category === tab.key ? "#fff" : "#1e293b",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
          <label style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, color: "#475569", fontWeight: 800 }}>
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Show unread only
          </label>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {!filtered.length && !loading ? (
            <div style={{ borderRadius: 20, border: "1px solid rgba(148,163,184,.18)", background: "#fff", padding: 18, color: "#64748b", fontWeight: 700 }}>
              No notifications found for this filter.
            </div>
          ) : null}

          {filtered.map((item) => {
            const tone = categoryTone(item.category);
            const meta = item.meta && typeof item.meta === "object" ? item.meta : {};
            const chips = renderMetaChips(item);
            const comment = safeStr(meta.comment);
            return (
              <button
                key={safeStr(item.notificationId)}
                type="button"
                onClick={() => void openItem(item)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: `1px solid ${item.read ? "rgba(148,163,184,.14)" : "rgba(56,189,248,.20)"}`,
                  borderRadius: 22,
                  background: item.read ? "#fff" : "linear-gradient(180deg, rgba(14,165,233,.08), rgba(255,255,255,1))",
                  padding: 18,
                  display: "grid",
                  gap: 10,
                  cursor: "pointer",
                  boxShadow: "0 14px 28px rgba(15,23,42,.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 12,
                        background: tone.chip,
                        color: tone.text,
                        display: "inline-grid",
                        placeItems: "center",
                        boxShadow: !item.read ? `0 0 0 4px ${tone.chip}` : "none",
                        flex: "0 0 auto",
                      }}
                    >
                      <i className="material-icons" style={{ fontSize: 18 }}>{typeIcon(item.type, item.category)}</i>
                    </span>
                    <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
                      <span style={{ fontWeight: 900, color: "#0f172a", fontSize: 16 }}>{safeStr(item.title) || "Notification"}</span>
                      <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{relativeTime(item.createdAt)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: tone.text, background: tone.chip, borderRadius: 999, padding: "6px 10px", fontWeight: 800, fontSize: 11 }}>
                      {tone.label}
                    </span>
                    {!item.read ? (
                      <span style={{ color: "#1d4ed8", background: "rgba(37,99,235,.10)", borderRadius: 999, padding: "6px 10px", fontWeight: 900, fontSize: 11 }}>
                        New
                      </span>
                    ) : null}
                  </div>
                </div>
                <div style={{ color: "#334155", fontSize: 14, lineHeight: 1.6, fontWeight: 700 }}>
                  {safeStr(item.body)}
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
                {comment ? (
                  <div
                    style={{
                      borderRadius: 14,
                      border: "1px solid rgba(148,163,184,.16)",
                      background: "rgba(248,250,252,.92)",
                      padding: 12,
                      color: "#334155",
                      fontSize: 13,
                      lineHeight: 1.55,
                      fontWeight: 700,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>
                      Review note
                    </div>
                    {comment}
                  </div>
                ) : null}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      color: "#1d4ed8",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    Open
                    <i className="material-icons" style={{ fontSize: 16 }}>arrow_forward</i>
                  </span>
                </div>
              </button>
            );
          })}

          {loading ? (
            <div style={{ color: "#64748b", fontWeight: 700, padding: 12 }}>Loading notifications...</div>
          ) : null}

          {nextCursor && !loading ? (
            <button type="button" style={{ ...actionButtonStyle, justifyContent: "center" }} onClick={() => void load(nextCursor, true)} disabled={loadingMore}>
              <i className="material-icons" style={{ fontSize: 18 }}>{loadingMore ? "hourglass_empty" : "expand_more"}</i>
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
