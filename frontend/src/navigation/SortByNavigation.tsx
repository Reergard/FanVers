import { useMemo } from "react";
import styles from "./SortByNavigation.module.css";

type SortOption = {
  value: string;
  label: string;
};

type SortByNavigationProps = {
  value: string;
  options: SortOption[];
  onChange: (nextValue: string) => void;
  ariaLabel: string;
  labelText?: string;
  className?: string;
};

export function SortByNavigation({
  value,
  options,
  onChange,
  ariaLabel,
  labelText = "Сортувати",
  className,
}: SortByNavigationProps) {
  const currentLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? "",
    [options, value]
  );

  const rootClassName = [styles.root, className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      <span className={styles.sortLabel}>{labelText}</span>
      <label className={styles.sortPill}>
        <span className={styles.sortPillText}>{currentLabel}</span>
        <select
          className={styles.sortSelect}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={ariaLabel}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className={styles.sortCaret} aria-hidden="true" />
      </label>
    </div>
  );
}
