import React from "react";
import styles from "./ActionButton.module.css";

type Props = {
  as?: "button" | "a";
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
};

export function ActionButton({
  as = "button",
  href,
  onClick,
  children,
  className,
  ariaLabel,
}: Props) {
  const cls = [styles.btn, className].filter(Boolean).join(" ");

  if (as === "a") {
    return (
      <a className={cls} href={href} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={cls} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
