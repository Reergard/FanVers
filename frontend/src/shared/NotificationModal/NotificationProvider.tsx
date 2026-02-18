import React, { useState, useCallback } from "react";
import { NotificationModal } from "./NotificationModal";
import { AutoCloseNotificationModal } from "./AutoCloseNotificationModal";

type NotificationType = "error" | "success" | "info" | "warning";

type NotificationContextType = {
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  /** Успіх без кнопок: зникає через 3 с (для сторінки створення глави) */
  showSuccessAutoClose: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
};

const NotificationContext = React.createContext<NotificationContextType | null>(null);

type NotificationState = {
  open: boolean;
  message: string;
  type: NotificationType;
  variant: "default" | "autoClose";
};

const AUTO_CLOSE_MS = 3000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: "",
    type: "error",
    variant: "default",
  });

  const showNotification = useCallback((message: string, type: NotificationType) => {
    setNotification({ open: true, message, type, variant: "default" });
  }, []);

  const showSuccessAutoClose = useCallback((message: string) => {
    setNotification({ open: true, message, type: "success", variant: "autoClose" });
  }, []);

  const closeNotification = useCallback(() => {
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  const contextValue: NotificationContextType = {
    showError: (message) => showNotification(message, "error"),
    showSuccess: (message) => showNotification(message, "success"),
    showSuccessAutoClose,
    showInfo: (message) => showNotification(message, "info"),
    showWarning: (message) => showNotification(message, "warning"),
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      {notification.variant === "autoClose" ? (
        <AutoCloseNotificationModal
          open={notification.open}
          onClose={closeNotification}
          message={notification.message}
          autoCloseMs={AUTO_CLOSE_MS}
        />
      ) : (
        <NotificationModal
          open={notification.open}
          onClose={closeNotification}
          message={notification.message}
          type={notification.type}
        />
      )}
    </NotificationContext.Provider>
  );
}

// Хук для использования уведомлений
export function useNotification(): NotificationContextType {
  const context = React.useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
}
