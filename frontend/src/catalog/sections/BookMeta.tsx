import type { ReactNode } from "react";
import styles from "../styles/BookDetail.module.css";

export type MetaRow = {
  label: string;
  value: ReactNode;
};

type BookMetaProps = {
  rows: MetaRow[];
};

export function BookMeta({ rows }: BookMetaProps) {
  return (
    <div className={styles.metaBlock} role="list">
      <div className={styles.metaList}>
        {rows.map(({ label, value }, i) => (
          <div key={i} className={styles.metaRow} role="listitem">
            <span className={styles.metaLabel}>{label}</span>
            <span className={styles.metaValue}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
