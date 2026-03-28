import styles from "./SectionLineTitle.module.css";

type SectionLineTitleProps = {
  text: string;
  className?: string;
  /** Для aria-labelledby у секцій з каруселями тощо */
  labelId?: string;
  /** Семантика заголовка секції (ієрархія на сторінці) */
  heading?: "h2" | "h3";
};

export function SectionLineTitle({
  text,
  className,
  labelId,
  heading = "h2",
}: SectionLineTitleProps) {
  const rootClassName = [styles.root, className].filter(Boolean).join(" ");
  const Heading = heading === "h3" ? "h3" : "h2";

  return (
    <div className={rootClassName}>
      <Heading id={labelId} className={styles.label}>
        {text}
      </Heading>
      <span className={styles.line} aria-hidden="true" />
    </div>
  );
}

export default SectionLineTitle;
