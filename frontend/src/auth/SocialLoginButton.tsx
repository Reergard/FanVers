import React from "react";
import { Icon } from "../shared/Icon";
import styles from "./SocialLoginButton.module.css";

type Props = {
  provider: "facebook" | "google";
  label: string;
  href?: string;
  onClick?: () => void;
};

/**
 * Кнопка входу через соцмережу (Facebook або Google) з двома станами:
 * - за замовчуванням: світла рамка, прозорий фон, світло-сірий текст, бірюзовий круг іконки
 * - hover/active: біла рамка, темний фон, білий текст
 */
export function SocialLoginButton({ provider, label, href, onClick }: Props) {
  const iconName = provider === "facebook" ? "facebook-btn" : "google";
  const iconColorClass = provider === "facebook" ? styles.iconFacebook : styles.iconGoogle;

  const content = (
    <>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.iconWrap} ${iconColorClass}`}>
        <Icon name={iconName} className={styles.icon} title={label} />
      </span>
    </>
  );

  const className = `${styles.button} ${iconColorClass}`;

  if (href) {
    return (
      <a href={href} className={className} aria-label={`Увійти через ${label}`}>
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
