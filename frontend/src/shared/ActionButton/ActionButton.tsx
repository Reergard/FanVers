import React from "react";
import { Link } from "react-router-dom";
import styles from "./ActionButton.module.css";
import showMoreArrowSvg from "../../assets/backgrounds/Стрелоска Авторов.svg";

export type ActionButtonVariant =
  | "default"
  | "primary"
  | "outline"
  | "ghost"
  | "danger"
  | "bookFrame"
  | "showMore";
export type ActionButtonSize = "sm" | "md" | "lg";

type Props = {
  as?: "button" | "a";
  href?: string;
  /** React Router path — рендерить Link замість button (кліентська навігація) */
  to?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  /** Варіант стилю: default, primary (як button 6.svg), outline (як Frame 4.svg), ghost, danger */
  variant?: ActionButtonVariant;
  /** Розмір кнопки */
  size?: ActionButtonSize;
  /** Розтягнути на всю ширину контейнера */
  fullWidth?: boolean;
  /** Показати стан завантаження (кнопка disabled + індикатор) */
  loading?: boolean;
  /** Іконка зліва від тексту */
  leftIcon?: React.ReactNode;
  /** Іконка справа від тексту */
  rightIcon?: React.ReactNode;
};

export function ActionButton({
  as = "button",
  href,
  to,
  onClick,
  children,
  className,
  ariaLabel,
  type = "button",
  disabled,
  variant = "default",
  size = "md",
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
}: Props) {
  const isDisabled = disabled || loading;
  const cls = [
    styles.btn,
    styles[`variant_${variant}`],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    loading && styles.loading,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {loading && <span className={styles.spinner} aria-hidden />}
      {!loading && leftIcon && <span className={styles.iconLeft}>{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className={styles.iconRight}>{rightIcon}</span>}
    </>
  );

  const inner = to != null ? (
    <Link to={to} className={cls} aria-label={ariaLabel} aria-busy={loading}>
      {content}
    </Link>
  ) : as === "a" ? (
    <a className={cls} href={href} aria-label={ariaLabel} aria-busy={loading}>
      {content}
    </a>
  ) : (
    <button
      type={type}
      className={cls}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={isDisabled}
      aria-busy={loading}
    >
      {content}
    </button>
  );

  if (variant === "bookFrame") {
    return (
      <span className={styles.bookFrameWrap}>
        {inner}
      </span>
    );
  }

  return inner;
}

type ShowMoreButtonProps = Omit<Props, "variant" | "leftIcon">;

export function ShowMoreButton({ children = "Показати ще", ariaLabel, ...rest }: ShowMoreButtonProps) {
  return (
    <ActionButton
      {...rest}
      variant="showMore"
      ariaLabel={ariaLabel ?? "Показати ще"}
      leftIcon={<img src={showMoreArrowSvg} className={styles.showMoreIcon} alt="" aria-hidden="true" />}
    >
      {children}
    </ActionButton>
  );
}
