import React from "react";
import { Icon } from "../shared/Icon";
import styles from "./AuthModalContent.module.css";

type Props = {
  children: React.ReactNode;
};

/**
 * Обгортка для контенту модалки входу/реєстрації з декоративними SVG (зірки).
 */
export function AuthModalContent({ children }: Props) {
  return (
    <div className={styles.wrapper}>
      {/* Декоративні зірки — розташування як у дизайні */}
      <span className={styles.star1} aria-hidden>
        <Icon name="star-srednyaya" />
      </span>
      <span className={styles.star2} aria-hidden>
        <Icon name="star-srednyaya" />
      </span>
      <span className={styles.star3} aria-hidden>
        <Icon name="star-malenkaya" />
      </span>
      <span className={styles.star4} aria-hidden>
        <Icon name="star-srednyaya" />
      </span>
      <span className={styles.star5} aria-hidden>
        <Icon name="star-srednyaya" />
      </span>
      <span className={styles.star7} aria-hidden>
        <Icon name="star-malenkaya" />
      </span>
      <span className={styles.star9} aria-hidden>
        <Icon name="star-malenkaya" />
      </span>

      <div className={styles.content}>{children}</div>
    </div>
  );
}
