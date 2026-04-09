import { Container } from "../shared/Container";
import styles from "./ChapterDetailSkeleton.module.css";

export default function ChapterDetailSkeleton() {
  const lines = Array.from({ length: 14 }, (_, i) => i);
  return (
    <Container>
      <div className={styles.wrap} aria-busy="true" aria-label="Завантаження розділу">
        <div className={styles.titleBar} />
        {lines.map((i) => (
          <div
            key={i}
            className={`${styles.block} ${i % 5 === 0 ? styles.blockShort : i % 7 === 0 ? styles.blockMid : styles.blockWide}`}
          />
        ))}
      </div>
    </Container>
  );
}
