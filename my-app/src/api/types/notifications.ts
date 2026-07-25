export type ApiNotificationMeta = Record<string, any>;

export type ApiNotificationItem = {
  recipientUsername?: string;
  notificationId?: string;
  type?: string;
  category?: string;
  title?: string;
  body?: string;
  href?: string;
  entityType?: string;
  entityId?: string;
  actorUsername?: string;
  read?: boolean;
  readAt?: string;
  createdAt?: string;
  meta?: ApiNotificationMeta;
  [k: string]: any;
};

export type ApiNotificationsResponse = {
  ok: boolean;
  items: ApiNotificationItem[];
  nextCursor?: string | null;
  unreadCount?: number;
};

export type ApiNotificationDetailResponse = {
  ok: boolean;
  notification: ApiNotificationItem;
};
