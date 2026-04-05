import { http } from "../api/http";
import { API } from "../api/endpoints";
import type { AppNotification, NotificationsResponse } from "./types";

/** Узгоджуємо з DRF (snake_case); на випадок camelCase з майбутніх адаптерів. */
export function normalizeNotification(raw: unknown): AppNotification {
  if (!raw || typeof raw !== "object") {
    return {
      id: 0,
      message: "",
      is_read: false,
      created_at: "",
    };
  }
  const o = raw as Record<string, unknown>;
  const id = o.id;
  return {
    id: typeof id === "string" || typeof id === "number" ? id : 0,
    message: String(o.message ?? ""),
    is_read: Boolean(o.is_read),
    created_at: String(o.created_at ?? ""),
    title: o.title != null ? String(o.title) : undefined,
    error_report_id: (o.error_report_id ?? o.errorReportId) as number | string | undefined,
    reporter_username: (o.reporter_username ?? o.reporterUsername) as string | undefined,
    book_title: (o.book_title ?? o.bookTitle) as string | undefined,
    chapter_title: (o.chapter_title ?? o.chapterTitle) as string | undefined,
    error_text: (o.error_text ?? o.errorText) as string | undefined,
    suggestion: typeof o.suggestion === "string" ? o.suggestion : undefined,
    book: o.book,
  };
}

function normalizeNotifications(data: NotificationsResponse): {
  items: AppNotification[];
  version: string | null;
} {
  if (Array.isArray(data)) {
    return {
      items: data.filter((x) => x && (x as AppNotification).id).map((x) => normalizeNotification(x)),
      version: "0",
    };
  }

  const items = Array.isArray(data.notifications) ? data.notifications : [];
  return {
    items: items.filter((x) => x && (x as AppNotification).id).map((x) => normalizeNotification(x)),
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

/** Повне повідомлення (деталі репорту: розділ, фрагмент, suggestion). */
export async function getNotificationById(id: number | string): Promise<AppNotification> {
  const res = await http.get(API.notificationById(id));
  return normalizeNotification(res.data);
}
