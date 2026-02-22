import type { ReactNode } from "react";
import { ShowMoreButton } from "../shared/ActionButton/ActionButton";
import styles from "./ShowMoreNavigation.module.css";

type ShowMoreNavigationProps = {
  visibleCount: number;
  totalCount: number;
  onShowMore: () => void;
  ariaLabel?: string;
  className?: string;
  children?: ReactNode;
};

export function ShowMoreNavigation({
  visibleCount,
  totalCount,
  onShowMore,
  ariaLabel = "Показати ще",
  className,
  children = "Показати ще",
}: ShowMoreNavigationProps) {
  const hasMore = visibleCount < totalCount;

  if (!hasMore) {
    return null;
  }

  const rootClassName = [styles.root, className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      <ShowMoreButton onClick={onShowMore} ariaLabel={ariaLabel}>
        {children}
      </ShowMoreButton>
    </div>
  );
}
