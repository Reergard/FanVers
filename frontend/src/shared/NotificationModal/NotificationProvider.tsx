import React, { useState, useCallback } from "react";
import { NotificationModal } from "./NotificationModal";

type NotificationType = "error" | "success" | "info" | "warning";

type NotificationContextType = {
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
};

const NotificationContext = React.createContext<NotificationContextType | null>(null);

type NotificationState = {
  open: boolean;
  message: string;
  type: NotificationType;
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: "",
    type: "error",
  });

  const showNotification = useCallback((message: string, type: NotificationType) => {
    setNotification({ open: true, message, type });
  }, []);

  const closeNotification = useCallback(() => {
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  const contextValue: NotificationContextType = {
    showError: (message) => showNotification(message, "error"),
    showSuccess: (message) => showNotification(message, "success"),
    showInfo: (message) => showNotification(message, "info"),
    showWarning: (message) => showNotification(message, "warning"),
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationModal
        open={notification.open}
        onClose={closeNotification}
        message={notification.message}
        type={notification.type}
      />
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
