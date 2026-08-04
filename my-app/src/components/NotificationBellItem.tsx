import type { ApiNotificationItem } from "../api";
import {
  notificationChips,
  notificationIcon,
  notificationIconChipStyle,
  notificationIconStyle,
  notificationLabel,
  notificationTone,
} from "../lib/notifications";

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

type Props = {
  item: ApiNotificationItem;
  onOpen: (item: ApiNotificationItem) => void;
  onMarkRead: (item: ApiNotificationItem) => void;
};

export function NotificationBellItem({ item, onOpen, onMarkRead }: Props) {
  const tone = notificationTone(item.category);
  const meta = item.meta && typeof item.meta === "object" ? item.meta : {};
  const chips = notificationChips(item);
  const comment = safeStr(meta.comment);
  const unread = !item.read;

  return (
    <div
      className={`notification-bell-card${unread ? " is-unread" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item);
        }
      }}
    >
      <div className="notification-bell-card__top">
        <div className="notification-bell-card__identity">
          <span
            className="notification-bell-card__iconChip"
            style={{
              background: tone.chip,
              color: tone.text,
              boxShadow: unread ? `0 0 0 4px ${tone.chip}` : "none",
              ...notificationIconChipStyle,
            }}
          >
            <i className="material-icons notification-bell-card__icon" style={notificationIconStyle}>
              {notificationIcon(item.type, item.category, item.meta)}
            </i>
          </span>
          <div className="notification-bell-card__titles">
            <span className="notification-bell-card__title">{safeStr(item.title) || "Notification"}</span>
            <span className="notification-bell-card__time">{relativeTime(item.createdAt)}</span>
          </div>
        </div>

        <span className="notification-bell-card__tag" style={{ color: tone.text, background: tone.chip }}>
          {notificationLabel(item)}
        </span>
      </div>

      <div className="notification-bell-card__body">{safeStr(item.body)}</div>

      {chips.length ? (
        <div className="notification-bell-card__chips">
          {chips.map((chip) => (
            <span key={chip.key} className="notification-bell-card__chip">
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}

      {comment ? <div className="notification-bell-card__comment">{comment}</div> : null}

      <div className="notification-bell-card__footer">
        <span className="notification-bell-card__hint" title="Tap anywhere on the card to open">
          <i className="material-icons">touch_app</i>
          Tap to open
        </span>

        {unread ? (
          <button
            type="button"
            className="notification-bell-card__mark"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(item);
            }}
            title="Mark this notification as read"
            aria-label="Mark this notification as read"
          >
            <i className="material-icons">mark_email_read</i>
          </button>
        ) : null}
      </div>
    </div>
  );
}
