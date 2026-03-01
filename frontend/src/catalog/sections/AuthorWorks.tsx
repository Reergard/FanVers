import type { ReactNode } from "react";
import styles from "../styles/BookDetail.module.css";

type AuthorWorksProps = {
  children?: ReactNode;
};

export function AuthorWorks({ children }: AuthorWorksProps) {
  return (
    <section className={styles.authorWorks} aria-labelledby="author-works-heading">
      <div className={styles.headingWithLine}>
        <h3 id="author-works-heading">ІНШІ РОБОТИ АВТОРА:</h3>
        <span className={styles.headingLine} aria-hidden="true" />
      </div>
      <div className={styles.authorWorksInner}>
        {children ?? null}
      </div>
    </section>
  );
}
