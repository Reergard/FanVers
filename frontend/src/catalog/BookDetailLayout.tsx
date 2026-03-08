import type { ReactNode } from "react";
import styles from "./styles/BookDetail.module.css";
import { Breadcrumb } from "../navigation/Breadcrumb";
import type { BreadcrumbItem } from "../navigation/Breadcrumb";

export type BookDetailLayoutProps = {
  hero: ReactNode;
  description: ReactNode;
  authorWorks: ReactNode;
  chapters: ReactNode;
  comments: ReactNode;
  breadcrumbItems?: BreadcrumbItem[];
};

export function BookDetailLayout({
  hero,
  description,
  authorWorks,
  chapters,
  comments,
  breadcrumbItems,
}: BookDetailLayoutProps) {
  return (
    <article className={styles.page}>
      {breadcrumbItems && breadcrumbItems.length > 0 && (
        <div className={styles.content} style={{ paddingBlockEnd: 4 }}>
          <Breadcrumb items={breadcrumbItems} />
        </div>
      )}
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
