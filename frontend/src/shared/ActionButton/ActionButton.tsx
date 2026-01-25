import React from "react";
import styles from "./ActionButton.module.css";

type Props = {
  as?: "button" | "a";
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

export function ActionButton({
  as = "button",
  href,
  onClick,
  children,
  className,
  ariaLabel,
  type = "button",
  disabled,
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
    <button
      type={type}
      className={cls}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
