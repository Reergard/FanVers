import type { ReactNode } from "react";
import styles from "../styles/BookDetail.module.css";

export type MetaRow = {
  label: string;
  value: ReactNode;
};

type BookMetaProps = {
  rows: MetaRow[];
  /** Chips: label left, values right */
  variant?: "default" | "chips";
};

function parseChipsValue(value: ReactNode): string[] {
  if (value == null) return ["—"];
  const s = String(value).trim();
  if (!s || s === "—") return ["—"];
  return s.split(/\s*,\s*/).filter(Boolean);
}

export function BookMeta({ rows, variant = "default" }: BookMetaProps) {
  if (variant === "chips") {
    return (
      <div className={`${styles.metaBlock} ${styles.metaBlockChips}`} role="list">
        {rows.map(({ label, value }, i) => {
          const chips = parseChipsValue(value);
          return (
            <div key={i} className={styles.metaChipsRow} role="listitem">
              <span className={styles.metaChipsLabel}>{label}</span>
              <div className={styles.metaChipsValues}>
                {chips.map((chip, j) => (
                  <span key={j} className={styles.metaChip}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

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
