import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteNotification,
  getNotifications,
  markNotificationAsRead,
} from "./notificationsService";
import type { AppNotification } from "./types";

const KEY = ["notifications"];

export function useNotifications(enabled = true) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    enabled,
    queryFn: async () => {
      const prev = qc.getQueryData<{
        notifications: AppNotification[];
        version: string | null;
      }>(KEY);
      const result = await getNotifications({ version: prev?.version ?? null });

      if (result.notifications.length === 0 && prev?.notifications?.length) {
        return { notifications: prev.notifications, version: result.version };
      }

      return result;
    },
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  });

  const markRead = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: (id) => {
      qc.setQueryData(KEY, (prev: { notifications: AppNotification[] } | undefined) => {
        if (!prev?.notifications) return prev;
        return {
          ...prev,
          notifications: prev.notifications.map((n) =>
            n.id === id ? { ...n, is_read: true } : n
          ),
        };
      });
    },
  });

  const remove = useMutation({
    mutationFn: deleteNotification,
    onSuccess: (id) => {
      qc.setQueryData(KEY, (prev: { notifications: AppNotification[] } | undefined) => {
        if (!prev?.notifications) return prev;
        return {
          ...prev,
          notifications: prev.notifications.filter((n) => n.id !== id),
        };
      });
    },
  });

  return { query, markRead, remove };
}
