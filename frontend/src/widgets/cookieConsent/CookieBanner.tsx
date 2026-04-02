import { Link } from "react-router-dom";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import styles from "./CookieConsentManager.module.css";

export function CookieBanner(props: {
  saving: boolean;
  onAcceptAll: () => void;
  onReject: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div
      className={styles.banner}
      role="region"
      aria-label="Cookie consent"
      aria-busy={props.saving}
    >
      <div className={styles.bannerInner}>
        <div className={styles.text}>
          <span className={styles.title}>Cookies</span>
          <span className={styles.desc}>
            Ми використовуємо <strong>необхідні</strong> cookies для логіну, безпеки та роботи сайту.
            Необовʼязкові категорії можна вимкнути.{" "}
            <Link className={styles.link} to="/cookie-policy">
              Політика cookies
            </Link>
            .
          </span>
        </div>

        <div className={styles.actions}>
          <ActionButton
            variant="primary"
            size="sm"
            onClick={props.onAcceptAll}
            disabled={props.saving}
            loading={props.saving}
          >
            Прийняти всі
          </ActionButton>
          <ActionButton
            variant="outline"
            size="sm"
            onClick={props.onReject}
            disabled={props.saving}
            loading={props.saving}
          >
            Відхилити
          </ActionButton>
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={props.onOpenSettings}
            disabled={props.saving}
            loading={props.saving}
          >
            Налаштувати
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

