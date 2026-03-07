import { Icon } from "../shared/Icon";
import { API } from "../api/endpoints";
import styles from "./SocialLoginButton.module.css";

const baseURL = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL ?? "");

type Props = {
  provider: "facebook" | "google";
  label: string;
  href?: string;
  onClick?: () => void;
};

/**
 * Кнопка входу через соцмережу (Facebook або Google).
 * За замовчуванням — посилання на backend OAuth URL.
 */
export function SocialLoginButton({ provider, label, href, onClick }: Props) {
  const iconName = provider === "facebook" ? "facebook-btn" : "google";
  const iconColorClass = provider === "facebook" ? styles.iconFacebook : styles.iconGoogle;
  const oauthProvider = provider === "facebook" ? "facebook" : "google-oauth2";
  const defaultHref = `${baseURL}${API.oauthBegin(oauthProvider)}`;

  const content = (
    <>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.iconWrap} ${iconColorClass}`}>
        <Icon name={iconName} className={styles.icon} title={label} />
      </span>
    </>
  );

  const className = `${styles.button} ${iconColorClass}`;

  if (href ?? defaultHref) {
    return (
      <a
        href={href ?? defaultHref}
        className={className}
        aria-label={`Увійти через ${label}`}
      >
        {content}
      </a>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick} aria-label={`Увійти через ${label}`}>
      {content}
    </button>
  );
}
