import React from "react";
import saveIcon from "../../assets/icons/Save.svg";
import styles from "./SaveButton.module.css";

type Props = {
  children?: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  /** Стиль: default (сірий), green (зелений для пароля) */
  variant?: "default" | "green";
};

export function SaveButton({
  children = "Зберегти",
  onClick,
  type = "button",
  disabled,
  loading = false,
  className,
  variant = "default",
}: Props) {
  const isDisabled = disabled || loading;
  const cls = [
    styles.btn,
    styles[`variant_${variant}`],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={cls}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading}
    >
      <img src={saveIcon} alt="" className={styles.icon} aria-hidden="true" />
      <span>{loading ? "Збереження..." : children}</span>
    </button>
  );
}
