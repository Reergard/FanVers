export type AppNotification = {
  id: number | string;
  message: string;
  is_read: boolean;
  created_at: string;

  // optional (from backend)
  title?: string;
  error_report_id?: number | string;
  reporter_username?: string;
  book_title?: string;
  book?: unknown;
};

export type NotificationsResponse =
  | AppNotification[] // legacy format: array
  | {
      notifications: AppNotification[];
      version?: string;
    };
