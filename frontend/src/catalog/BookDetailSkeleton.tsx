import { BookDetailLayout } from "./BookDetailLayout";
import styles from "./styles/BookDetail.module.css";

export default function BookDetailSkeleton() {
  const heroSkeleton = (
    <section className={styles.skeletonHero} aria-hidden="true">
      <div className={styles.skeletonHeroInner}>
        <div className={styles.skeletonTitleBar}>
          <div className={styles.skeletonTitle} />
        </div>
        <div className={styles.skeletonGrid}>
          <div className={styles.skeletonCover} />
          <div className={styles.skeletonMeta}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={styles.skeletonMetaRow} />
            ))}
          </div>
          <div className={styles.skeletonMeta}>
            <div className={styles.skeletonMetaRow} />
            <div className={styles.skeletonMetaRow} />
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <BookDetailLayout
      hero={heroSkeleton}
      description={<div className={styles.skeletonBlock} />}
      authorWorks={<div className={styles.skeletonBlock} />}
      chapters={
        <div className={styles.skeletonChapters}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.skeletonChapterRow} />
          ))}
        </div>
      }
      comments={<div className={styles.skeletonComments} />}
    />
  );
}
