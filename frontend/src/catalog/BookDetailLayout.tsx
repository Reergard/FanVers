import type { ReactNode } from "react";
import styles from "./styles/BookDetail.module.css";

export type BookDetailLayoutProps = {
  hero: ReactNode;
  description: ReactNode;
  authorWorks: ReactNode;
  chapters: ReactNode;
  comments: ReactNode;
};

export function BookDetailLayout({
  hero,
  description,
  authorWorks,
  chapters,
  comments,
}: BookDetailLayoutProps) {
  return (
    <article className={styles.page}>
      {hero}

      <section className={styles.content} aria-label="Контент сторінки книги">
        {description}
        {authorWorks}
        {chapters}
        {comments}
      </section>
    </article>
  );
}
