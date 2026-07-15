import type { ApiNotificationItem } from "../api";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export type NotificationTone = {
  dot: string;
  chip: string;
  text: string;
  label: string;
};

type NotificationStyle = {
  icon: string;
  dot: string;
  chip: string;
  text: string;
  label: string;
};

const CATEGORY_STYLE: Record<string, NotificationStyle> = {
  social_media: { icon: "campaign", dot: "#2563eb", chip: "rgba(37,99,235,.12)", text: "#1d4ed8", label: "Social" },
  weekly_updates: { icon: "event_note", dot: "#0f766e", chip: "rgba(15,118,110,.12)", text: "#0f766e", label: "Weekly" },
  applicants: { icon: "group_add", dot: "#9333ea", chip: "rgba(147,51,234,.12)", text: "#7e22ce", label: "Applicants" },
  mentions: { icon: "alternate_email", dot: "#db2777", chip: "rgba(219,39,119,.12)", text: "#be185d", label: "Mentions" },
  commerce: { icon: "storefront", dot: "#ca8a04", chip: "rgba(234,179,8,.14)", text: "#a16207", label: "Commerce" },
  system: { icon: "notifications", dot: "#475569", chip: "rgba(148,163,184,.12)", text: "#475569", label: "System" },
};

// Per-type overrides layered on top of the category defaults above, keyed by exact `type`.
// A function form is used where the same `type` renders differently depending on payload meta
// (e.g. an applicant being newly received vs. rated, or a merch request approved vs. rejected).
const TYPE_STYLE: Record<string, NotificationStyle | ((item: ApiNotificationItem) => NotificationStyle)> = {
  social_post_review_requested: { icon: "rate_review", dot: "#2563eb", chip: "rgba(37,99,235,.12)", text: "#1d4ed8", label: "Social" },
  social_post_published: { icon: "campaign", dot: "#16a34a", chip: "rgba(22,163,74,.12)", text: "#15803d", label: "Social" },
  social_post_mentioned: { icon: "alternate_email", dot: "#db2777", chip: "rgba(219,39,119,.12)", text: "#be185d", label: "Mention" },
  social_post_comment_added: { icon: "chat_bubble", dot: "#2563eb", chip: "rgba(37,99,235,.12)", text: "#1d4ed8", label: "Social" },
  social_post_changes_requested: { icon: "edit_note", dot: "#ea580c", chip: "rgba(234,88,12,.12)", text: "#c2410c", label: "Social" },
  weekly_update_submitted: { icon: "event_available", dot: "#0f766e", chip: "rgba(15,118,110,.12)", text: "#0f766e", label: "Weekly" },
  weekly_update_manager_submitted: { icon: "fact_check", dot: "#0f766e", chip: "rgba(15,118,110,.12)", text: "#0f766e", label: "Weekly" },
  weekly_update_missing_reminder: { icon: "alarm", dot: "#b45309", chip: "rgba(180,83,9,.12)", text: "#b45309", label: "Reminder" },
  wallet_credited: { icon: "account_balance_wallet", dot: "#ca8a04", chip: "rgba(202,138,4,.14)", text: "#a16207", label: "Wallet" },
  store_purchase_request_submitted: { icon: "shopping_cart", dot: "#2563eb", chip: "rgba(37,99,235,.12)", text: "#1d4ed8", label: "Store" },
  store_purchase_completed: { icon: "local_shipping", dot: "#16a34a", chip: "rgba(22,163,74,.12)", text: "#15803d", label: "Store" },
  applicant_admin_notify: (item) => {
    const isRated = Boolean(safeStr(item?.meta?.rating));
    return isRated
      ? { icon: "star", dot: "#9333ea", chip: "rgba(147,51,234,.12)", text: "#7e22ce", label: "Applicants" }
      : { icon: "person_add", dot: "#9333ea", chip: "rgba(147,51,234,.12)", text: "#7e22ce", label: "Applicants" };
  },
  store_purchase_request_reviewed: (item) => {
    const approved = safeStr(item?.meta?.decision).toLowerCase() === "approved";
    return approved
      ? { icon: "check_circle", dot: "#16a34a", chip: "rgba(22,163,74,.12)", text: "#15803d", label: "Store" }
      : { icon: "cancel", dot: "#dc2626", chip: "rgba(220,38,38,.12)", text: "#b91c1c", label: "Store" };
  },
};

function styleFor(item: Partial<ApiNotificationItem>): NotificationStyle {
  const type = safeStr(item?.type);
  const category = safeStr(item?.category).toLowerCase();
  const typeEntry = TYPE_STYLE[type];
  if (typeEntry) return typeof typeEntry === "function" ? typeEntry(item as ApiNotificationItem) : typeEntry;
  return CATEGORY_STYLE[category] || CATEGORY_STYLE.system;
}

export function notificationTone(category?: string): NotificationTone {
  const value = safeStr(category).toLowerCase();
  const style = CATEGORY_STYLE[value] || CATEGORY_STYLE.system;
  return { dot: style.dot, chip: style.chip, text: style.text, label: style.label };
}

export function notificationIcon(type?: string, category?: string, meta?: Record<string, any>) {
  return styleFor({ type, category, meta }).icon;
}

export function notificationLabel(item: ApiNotificationItem) {
  return styleFor(item).label;
}

// Icon + color together, resolved once per item so bell/page/detail views stay in sync.
export function notificationStyle(item: Partial<ApiNotificationItem>): NotificationStyle {
  return styleFor(item);
}

export function notificationChips(item: ApiNotificationItem) {
  const meta = item?.meta && typeof item.meta === "object" ? item.meta : {};
  const chips: Array<{ key: string; label: string }> = [];
  const channels = Array.isArray(meta.channels) ? meta.channels.map((x) => safeStr(x)).filter(Boolean) : [];
  channels.forEach((channel) => chips.push({ key: `channel-${channel}`, label: channel }));
  if (safeStr(item.actorUsername)) chips.push({ key: "actor", label: safeStr(item.actorUsername) });
  if (safeStr(meta.weekStart)) chips.push({ key: "week", label: `Week ${safeStr(meta.weekStart)}` });
  if (safeStr(meta.projectId)) chips.push({ key: "project", label: safeStr(meta.projectId) });
  if (safeStr(meta.amount_cents || meta.amountCents)) {
    const amount = Number(meta.amount_cents || meta.amountCents || 0) || 0;
    chips.push({ key: "amount", label: `${(amount / 100).toFixed(2)} FGC` });
  }
  if (safeStr(meta.total_cents || meta.totalCents)) {
    const total = Number(meta.total_cents || meta.totalCents || 0) || 0;
    chips.push({ key: "total", label: `${(total / 100).toFixed(2)} FGC` });
  }
  if (safeStr(meta.order_id || meta.orderId || item.entityId) && item.category === "commerce") {
    chips.push({ key: "order", label: safeStr(meta.order_id || meta.orderId || item.entityId) });
  }
  return chips.slice(0, 4);
}

export function notificationDetailHref(notificationId?: string) {
  const id = safeStr(notificationId);
  return id ? `/account/notifications/${encodeURIComponent(id)}` : "/account/notifications";
}

export function notificationOpenHref(item: ApiNotificationItem) {
  return safeStr(item.href) || "/";
}

export const notificationIconChipStyle = {
  width: 34,
  height: 34,
  borderRadius: 12,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 0,
  flex: "0 0 auto",
} as const;

export const notificationIconStyle = {
  display: "block",
  lineHeight: 1,
  transform: "translateY(2px)",
} as const;
