import { PillDropdownSelect } from "../shared/PillDropdownSelect/PillDropdownSelect";
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
  /** Показати текст зліва від пігулки (наприклад «Сортувати за») */
  showLabel?: boolean;
  /** Підписи в списку — стилем як на макеті (lowercase) */
  optionsLowercase?: boolean;
  className?: string;
};

export function SortByNavigation({
  value,
  options,
  onChange,
  ariaLabel,
  labelText = "Сортувати",
  showLabel = true,
  optionsLowercase = false,
  className,
}: SortByNavigationProps) {
  const rootClassName = [styles.root, className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      {showLabel ? <span className={styles.sortLabel}>{labelText}</span> : null}
      <PillDropdownSelect
        value={value}
        options={options}
        onChange={onChange}
        ariaLabel={ariaLabel}
        optionsLowercase={optionsLowercase}
      />
    </div>
  );
}
