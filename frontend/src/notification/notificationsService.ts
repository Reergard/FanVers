import { http } from "../api/http";
import { API } from "../api/endpoints";
import type { AppNotification, NotificationsResponse } from "./types";

function normalizeNotifications(data: NotificationsResponse): {
  items: AppNotification[];
  version: string | null;
} {
  if (Array.isArray(data)) {
    return { items: data.filter((x) => x && x.id), version: "0" };
  }

  const items = Array.isArray(data.notifications) ? data.notifications : [];
  return {
    items: items.filter((x) => x && x.id),
    version: data.version ?? null,
  };
}

export async function getNotifications(params?: { version?: string | null }) {
  const res = await http.get<NotificationsResponse>(API.notifications, {
    params: params?.version ? { version: params.version } : undefined,
    headers: { "Cache-Control": "no-cache" },
  });

  const normalized = normalizeNotifications(res.data);

  const unique = [...new Map(normalized.items.map((n) => [n.id, n])).values()];

  return { notifications: unique, version: normalized.version };
}

export async function markNotificationAsRead(id: number | string) {
  await http.patch(API.notificationMarkAsRead(id));
  return id;
}

export async function deleteNotification(id: number | string) {
  await http.delete(API.notificationById(id));
  return id;
}
