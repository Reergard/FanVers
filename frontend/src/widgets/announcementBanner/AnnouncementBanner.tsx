import { useCallback, useState } from "react";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import { useMedia } from "../../shared/hooks/useMedia";
import styles from "./AnnouncementBanner.module.css";

const STORAGE_KEY = "fv:announcement-dismissed";

function isDismissed(version: string): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === version;
  } catch {
    return false;
  }
}

function markDismissed(version: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch { /* quota / private mode */ }
}

export type AnnouncementBannerProps = {
  title: string;
  message: string;
  to: string;
  linkLabel?: string;
  visible?: boolean;
  version?: string;
};

export function AnnouncementBanner({
  title,
  message,
  to,
  linkLabel = "Детальніше",
  visible = true,
  version = "1",
}: AnnouncementBannerProps) {
  const isNarrowMobile = useMedia("(max-width: 480px)");
  const [dismissed, setDismissed] = useState(() => isDismissed(version));

  const dismiss = useCallback(() => {
    setDismissed(true);
    markDismissed(version);
  }, [version]);

  if (!visible || dismissed) return null;

  return (
    <aside className={styles.banner} role="status" aria-label="Оголошення">
      <div className={styles.inner}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={dismiss}
          aria-label="Закрити оголошення"
        >
          ×
        </button>
        <div className={styles.content}>
          <p className={styles.title}>{title}</p>
          <p className={styles.message}>{message}</p>
        </div>
        <div className={styles.actions}>
          <ActionButton variant="outline" size="sm" to={to} fullWidth={isNarrowMobile} onClick={dismiss}>
            {linkLabel}
          </ActionButton>
        </div>
      </div>
    </aside>
  );
}
