import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { ApiNotificationItem } from "../api";
import { notificationDetailHref } from "../lib/notifications";
import { NotificationBellPanel } from "./NotificationBellPanel";

declare const M: any;

function safeStr(v: any) {
  return String(v ?? "").trim();
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
        setItems((prev) =>
          prev.map((row) => (safeStr(row.notificationId) === safeStr(item.notificationId) ? { ...row, read: true } : row))
        );
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

  async function markOneRead(item: ApiNotificationItem) {
    if (!safeStr(item.notificationId) || item.read) return;
    try {
      const resp = await api.markNotificationsRead({ notificationId: safeStr(item.notificationId) });
      if (typeof resp?.unreadCount === "number") setUnreadCount(resp.unreadCount);
      setItems((prev) =>
        prev.map((row) => (safeStr(row.notificationId) === safeStr(item.notificationId) ? { ...row, read: true } : row))
      );
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Failed to mark notification read", classes: "red" });
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

      <NotificationBellPanel
        open={open}
        unreadCount={unreadCount}
        items={items}
        loading={loading}
        nextCursor={nextCursor}
        onMarkAllRead={() => void markAllRead()}
        onViewAll={() => {
          setOpen(false);
          navigate("/account/notifications");
        }}
        onLoadMore={() => void loadList(nextCursor ?? undefined, true)}
        onOpenItem={(item) => void openItem(item)}
        onMarkOneRead={(item) => void markOneRead(item)}
      />
    </div>
  );
}
