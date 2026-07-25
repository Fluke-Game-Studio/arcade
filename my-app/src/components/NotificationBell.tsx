import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { ApiNotificationItem } from "../api";
import { notificationChips, notificationDetailHref, notificationIcon, notificationIconChipStyle, notificationIconStyle, notificationLabel, notificationTone } from "../lib/notifications";

declare const M: any;

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

export default function NotificationBell({ compact = false }: { compact?: boolean }) {
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ApiNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  async function loadCount() {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const resp = await api.getNotificationUnreadCount();
      setUnreadCount(Number(resp?.unreadCount || 0) || 0);
    } catch {
      setUnreadCount(0);
    }
  }

  async function loadList(cursor?: string, append = false) {
    if (!user) return;
    setLoading(true);
    try {
      const resp = await api.getNotifications({ limit: 8, cursor });
      const rows = Array.isArray(resp?.items) ? resp.items : [];
      setItems((prev) => (append ? [...prev, ...rows] : rows));
      setNextCursor(safeStr(resp?.nextCursor) || null);
      if (typeof resp?.unreadCount === "number") setUnreadCount(resp.unreadCount);
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Failed to load notifications", classes: "red" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCount();
    const id = window.setInterval(() => {
      void loadCount();
    }, 30000);
    return () => window.clearInterval(id);
  }, [user?.username]);

  useEffect(() => {
    if (!open) return;
    void loadList();
  }, [open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const buttonSize = compact ? 42 : 44;

  const hasItems = items.length > 0;

  const unreadLabel = useMemo(() => {
    if (unreadCount <= 0) return "";
    if (unreadCount > 99) return "99+";
    return String(unreadCount);
  }, [unreadCount]);

  async function openItem(item: ApiNotificationItem) {
    if (safeStr(item.notificationId) && !item.read) {
      try {
        const resp = await api.markNotificationsRead({ notificationId: safeStr(item.notificationId) });
        if (typeof resp?.unreadCount === "number") setUnreadCount(resp.unreadCount);
        setItems((prev) => prev.map((row) => safeStr(row.notificationId) === safeStr(item.notificationId) ? { ...row, read: true } : row));
      } catch {}
    }
    setOpen(false);
    navigate(safeStr(item.notificationId) ? notificationDetailHref(item.notificationId) : (safeStr(item.href) || "/"));
  }

  async function markAllRead() {
    try {
      const resp = await api.markNotificationsRead({ all: true });
      setUnreadCount(Number(resp?.unreadCount || 0) || 0);
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Failed to mark notifications read", classes: "red" });
    }
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="Notifications"
        aria-label="Notifications"
        style={{
          width: buttonSize,
          height: buttonSize,
          borderRadius: 14,
          border: "1px solid rgba(56,189,248,0.14)",
          background: open
            ? "linear-gradient(180deg, rgba(34,211,238,0.18), rgba(37,99,235,0.14))"
            : "linear-gradient(180deg, rgba(16,27,45,0.96), rgba(9,16,28,0.95))",
          color: "#f8fbff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          cursor: "pointer",
          boxShadow: open ? "0 0 22px rgba(59,130,246,0.14)" : "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <i className="material-icons" style={{ fontSize: 20 }}>notifications</i>
        {unreadCount > 0 ? (
          <span
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              minWidth: 22,
              height: 22,
              padding: "0 6px",
              borderRadius: 999,
              background: "linear-gradient(135deg,#ef4444,#f97316)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 950,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 18px rgba(239,68,68,.22)",
            }}
          >
            {unreadLabel}
          </span>
        ) : null}
      </button>

      <div
        style={{
          position: "absolute",
          top: "calc(100% + 12px)",
          right: 0,
          width: "min(420px, calc(100vw - 24px))",
          borderRadius: 22,
          background: "linear-gradient(180deg, rgba(8,14,24,0.98), rgba(10,18,34,0.97))",
          border: "1px solid rgba(56,189,248,0.18)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.04)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.985)",
          pointerEvents: open ? "auto" : "none",
          transition: "all 180ms ease",
          zIndex: 1350,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(148,163,184,.12)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ color: "#f8fbff", fontSize: 16, fontWeight: 900 }}>Notifications</div>
            <div style={{ color: "rgba(125,211,252,0.74)", fontSize: 12, fontWeight: 700 }}>
              {unreadCount > 0 ? `${unreadCount} unread` : "You are all caught up"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={unreadCount <= 0}
            style={{
              border: "1px solid rgba(148,163,184,.14)",
              background: unreadCount > 0 ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.02)",
              color: unreadCount > 0 ? "#e2e8f0" : "rgba(226,232,240,.42)",
              borderRadius: 999,
              padding: "8px 12px",
              fontWeight: 800,
              cursor: unreadCount > 0 ? "pointer" : "not-allowed",
            }}
          >
            Mark all read
          </button>
        </div>

        <div style={{ maxHeight: 460, overflowY: "auto", padding: 12, display: "grid", gap: 10 }}>
          {!hasItems && !loading ? (
            <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,.12)", background: "rgba(255,255,255,.03)", padding: 18, color: "#cbd5e1", fontWeight: 700 }}>
              No notifications yet.
            </div>
          ) : null}

          {items.map((item) => {
            const tone = notificationTone(item.category);
            const meta = item.meta && typeof item.meta === "object" ? item.meta : {};
            const chips = notificationChips(item);
            const comment = safeStr(meta.comment);
            return (
              <button
                key={safeStr(item.notificationId)}
                type="button"
                onClick={() => void openItem(item)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: `1px solid ${item.read ? "rgba(148,163,184,.12)" : "rgba(56,189,248,.18)"}`,
                  background: item.read
                    ? "linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,.02))"
                    : "linear-gradient(180deg, rgba(14,165,233,.09), rgba(37,99,235,.07))",
                  borderRadius: 18,
                  padding: 14,
                  cursor: "pointer",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span
                      style={{
                        background: tone.chip,
                        color: tone.text,
                        boxShadow: !item.read ? `0 0 0 4px ${tone.chip}` : "none",
                        ...notificationIconChipStyle,
                      }}
                    >
                      <i className="material-icons" style={{ fontSize: 16, ...notificationIconStyle }}>{notificationIcon(item.type, item.category, item.meta)}</i>
                    </span>
                    <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
                      <span style={{ color: "#f8fbff", fontWeight: 900, fontSize: 14, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {safeStr(item.title) || "Notification"}
                      </span>
                      <span style={{ color: "rgba(125,211,252,0.74)", fontSize: 11, fontWeight: 800 }}>
                        {relativeTime(item.createdAt)}
                      </span>
                    </div>
                  </div>
                  <span style={{ color: tone.text, background: tone.chip, borderRadius: 999, padding: "5px 9px", fontWeight: 800, fontSize: 11, flex: "0 0 auto" }}>
                    {notificationLabel(item)}
                  </span>
                </div>
                <div style={{ color: "rgba(226,232,240,0.86)", fontSize: 13, lineHeight: 1.5, fontWeight: 700 }}>
                  {safeStr(item.body)}
                </div>
                {chips.length ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {chips.map((chip) => (
                      <span
                        key={chip.key}
                        style={{
                          borderRadius: 999,
                          border: "1px solid rgba(148,163,184,.14)",
                          background: "rgba(255,255,255,.05)",
                          color: "#cbd5e1",
                          padding: "5px 8px",
                          fontSize: 10,
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
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,.12)",
                      background: "rgba(255,255,255,.04)",
                      padding: 10,
                      color: "#e2e8f0",
                      fontSize: 12,
                      lineHeight: 1.45,
                      fontWeight: 700,
                    }}
                  >
                    {comment}
                  </div>
                ) : null}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "rgba(125,211,252,0.74)", fontSize: 11, fontWeight: 800 }}>
                    Tap to open
                  </span>
                  {!item.read ? (
                    <span style={{ color: "#f8fbff", fontSize: 11, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" }}>
                      New
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}

          {loading ? (
            <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 13, padding: 8 }}>
              Loading notifications...
            </div>
          ) : null}

          {!loading && nextCursor ? (
            <button
              type="button"
              onClick={() => void loadList(nextCursor, true)}
              style={{
                border: "1px solid rgba(148,163,184,.14)",
                background: "rgba(255,255,255,.05)",
                color: "#f8fbff",
                borderRadius: 14,
                padding: "12px 14px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Load more
            </button>
          ) : null}
        </div>

        <div style={{ padding: 12, borderTop: "1px solid rgba(148,163,184,.12)" }}>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/account/notifications");
            }}
            style={{
              width: "100%",
              border: "1px solid rgba(148,163,184,.14)",
              background: "rgba(255,255,255,.05)",
              color: "#f8fbff",
              borderRadius: 14,
              padding: "12px 14px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            View all notifications
          </button>
        </div>
      </div>
    </div>
  );
}
