import styles from "./SectionLineTitle.module.css";

type SectionLineTitleProps = {
  text: string;
  className?: string;
};

export function SectionLineTitle({ text, className }: SectionLineTitleProps) {
  const rootClassName = [styles.root, className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      <span className={styles.label}>{text}</span>
      <span className={styles.line} aria-hidden="true" />
    </div>
  );
}

export default SectionLineTitle;
