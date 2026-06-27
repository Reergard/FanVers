import { useState } from "react";
import { FilterDropdown } from "./FilterDropdown";
import type { ChapterPageRange } from "../api/catalogApi";
import styles from "./ChapterRangeNavigation.module.css";

type ChapterRangeNavigationProps = {
  rangeStart: number;
  pageRanges: ChapterPageRange[];
  onChange: (start: number) => void;
  totalChapters?: number;
  className?: string;
};

export function ChapterRangeNavigation({
  rangeStart,
  pageRanges,
  onChange,
  totalChapters,
  className,
}: ChapterRangeNavigationProps) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  if (pageRanges.length === 0) return null;

  const currentRange = pageRanges.find((r) => r.start === rangeStart);
  const triggerLabel = currentRange?.label ?? String(rangeStart);
  const hint = totalChapters != null ? `з ${totalChapters}` : null;

  const rootClassName = [styles.root, className].filter(Boolean).join(" ");

  function close() {
    setOpen(false);
  }

  function handleTriggerClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (open) {
      close();
      return;
    }
    setAnchorEl(event.currentTarget);
    setOpen(true);
  }

  function handleSelect(start: number) {
    onChange(start);
    close();
  }

  return (
    <div className={rootClassName}>
      <span className={styles.label}>Показано розділів:</span>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Оберіть діапазон розділів"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={handleTriggerClick}
      >
        <span className={styles.triggerLabel}>{triggerLabel}</span>
        <span className={styles.caret} aria-hidden />
      </button>
      {hint ? <span className={styles.hint}>{hint}</span> : null}

      <FilterDropdown
        open={open}
        anchorEl={anchorEl}
        onClose={close}
        align="end"
        maxWidth={420}
        className={styles.dropdownPanel}
      >
        <button
          type="button"
          className={styles.closeBtn}
          onClick={close}
          aria-label="Закрити"
        >
          ×
        </button>
        <div className={styles.dropdownInner}>
          <div className={styles.optionsWrap}>
            <div className={styles.optionsGrid}>
              {pageRanges.map((range) => {
                const selected = range.start === rangeStart;
                return (
                  <button
                    key={range.start}
                    type="button"
                    className={selected ? `${styles.chip} ${styles.chipSelected}` : styles.chip}
                    onClick={() => handleSelect(range.start)}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </FilterDropdown>
    </div>
  );
}
