import styles from "./FilterCheckbox.module.css";

type Props = {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Додатковий клас для рядка */
  className?: string;
};

/** Чекбокс для фільтрів (стиль Messages: бірюзовий при виборі, кастомна галочка) */
export function FilterCheckbox({ id, label, checked, onChange, className }: Props) {
  return (
    <label className={[styles.row, className].filter(Boolean).join(" ")} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={styles.input}
      />
      <span className={styles.box} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </label>
  );
}
