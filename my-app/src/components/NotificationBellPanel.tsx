import type { ApiNotificationItem } from "../api";
import { NotificationBellItem } from "./NotificationBellItem";
import "./NotificationBell.css";

type Props = {
  open: boolean;
  unreadCount: number;
  items: ApiNotificationItem[];
  loading: boolean;
  nextCursor: string | null;
  onMarkAllRead: () => void;
  onViewAll: () => void;
  onLoadMore: () => void;
  onOpenItem: (item: ApiNotificationItem) => void;
  onMarkOneRead: (item: ApiNotificationItem) => void;
};

export function NotificationBellPanel({
  open,
  unreadCount,
  items,
  loading,
  nextCursor,
  onMarkAllRead,
  onViewAll,
  onLoadMore,
  onOpenItem,
  onMarkOneRead,
}: Props) {
  const hasItems = items.length > 0;

  return (
    <div className={`notification-bell-panel${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div className="notification-bell-panel__header">
        <div className="notification-bell-panel__heading">
          <div className="notification-bell-panel__title">Notifications</div>
          <div className="notification-bell-panel__subtitle">
            {unreadCount > 0 ? `${unreadCount} unread` : "You are all caught up"}
          </div>
        </div>

        <div className="notification-bell-panel__actions">
          <button
            type="button"
            className="notification-bell-iconButton"
            onClick={onMarkAllRead}
            disabled={unreadCount <= 0}
            title="Mark all notifications as read"
            aria-label="Mark all notifications as read"
          >
            <i className="material-icons">mark_email_read</i>
          </button>
          <button
            type="button"
            className="notification-bell-iconButton"
            onClick={onViewAll}
            title="Open full notifications page"
            aria-label="Open full notifications page"
          >
            <i className="material-icons">view_list</i>
          </button>
        </div>
      </div>

      <div className="notification-bell-panel__body">
        {!hasItems && !loading ? (
          <div className="notification-bell-empty">No notifications yet.</div>
        ) : null}

        {items.map((item) => (
          <NotificationBellItem
            key={String(item.notificationId ?? "")}
            item={item}
            onOpen={onOpenItem}
            onMarkRead={onMarkOneRead}
          />
        ))}

        {loading ? <div className="notification-bell-loading">Loading notifications...</div> : null}

        {nextCursor && !loading ? (
          <button type="button" className="notification-bell-loadMore" onClick={onLoadMore}>
            Load more
          </button>
        ) : null}
      </div>
    </div>
  );
}
