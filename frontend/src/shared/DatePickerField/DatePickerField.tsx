import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./DatePickerField.module.css";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const MONTHS_UK = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
] as const;

const WEEKDAYS_UK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseIso(s: string): { year: number; month: number; day: number } | null {
  if (!ISO_DATE.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { year: y, month: m - 1, day: d };
}

function todayIso(): string {
  const d = new Date();
  return toIso(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Day of week Monday-based: 0=Mon, 6=Sun */
function weekdayMon(year: number, month: number, day: number): number {
  const d = new Date(year, month, day).getDay();
  return d === 0 ? 6 : d - 1;
}

function formatDisplay(iso: string): string {
  const p = parseIso(iso);
  if (!p) return iso;
  return `${String(p.day).padStart(2, "0")}.${String(p.month + 1).padStart(2, "0")}.${p.year}`;
}

function parseDisplay(display: string): string {
  const m = display.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return "";
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const maxDay = daysInMonth(year, month - 1);
  if (day > maxDay) return "";
  return toIso(year, month - 1, day);
}

/* ------------------------------------------------------------------ */
/*  Dropdown position                                                  */
/* ------------------------------------------------------------------ */

type DropPos = { top?: number; bottom?: number; left: number; width: number };

function calcDropPos(anchor: HTMLElement): DropPos {
  const rect = anchor.getBoundingClientRect();
  const vH = window.innerHeight;
  const pad = 8;
  const calendarH = 320;
  const spaceBelow = vH - rect.bottom - pad;
  const spaceAbove = rect.top - pad;
  const openBelow = spaceBelow >= calendarH || spaceBelow >= spaceAbove;

  const width = Math.max(280, rect.width);
  let left = rect.left;
  if (left + width > window.innerWidth - pad) {
    left = window.innerWidth - pad - width;
  }
  left = Math.max(pad, left);

  return openBelow
    ? { top: rect.bottom + 4, left, width }
    : { bottom: vH - rect.top + 4, left, width };
}

/* ------------------------------------------------------------------ */
/*  Calendar grid                                                      */
/* ------------------------------------------------------------------ */

type CalendarGridProps = {
  year: number;
  month: number;
  selected: string;
  minDate: string;
  maxDate: string;
  onSelect: (iso: string) => void;
  onMonthChange: (y: number, m: number) => void;
};

function CalendarGrid({
  year,
  month,
  selected,
  minDate,
  maxDate,
  onSelect,
  onMonthChange,
}: CalendarGridProps) {
  const days = daysInMonth(year, month);
  const firstWeekday = weekdayMon(year, month, 1);

  const canPrev = useMemo(() => {
    if (!minDate) return true;
    const p = parseIso(minDate);
    if (!p) return true;
    return year > p.year || (year === p.year && month > p.month);
  }, [year, month, minDate]);

  const canNext = useMemo(() => {
    if (!maxDate) return true;
    const p = parseIso(maxDate);
    if (!p) return true;
    return year < p.year || (year === p.year && month < p.month);
  }, [year, month, maxDate]);

  const isDisabled = useCallback(
    (iso: string) => {
      if (minDate && iso < minDate) return true;
      if (maxDate && iso > maxDate) return true;
      return false;
    },
    [minDate, maxDate]
  );

  const handlePrev = () => {
    if (!canPrev) return;
    const m = month - 1;
    if (m < 0) onMonthChange(year - 1, 11);
    else onMonthChange(year, m);
  };

  const handleNext = () => {
    if (!canNext) return;
    const m = month + 1;
    if (m > 11) onMonthChange(year + 1, 0);
    else onMonthChange(year, m);
  };

  const cells: React.ReactNode[] = [];

  // Empty cells before the 1st
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(<span key={`e-${i}`} className={styles.emptyCell} />);
  }

  const today = todayIso();

  for (let d = 1; d <= days; d++) {
    const iso = toIso(year, month, d);
    const disabled = isDisabled(iso);
    const isSelected = iso === selected;
    const isToday = iso === today;
    const cls = [
      styles.dayCell,
      disabled ? styles.dayDisabled : styles.dayEnabled,
      isSelected ? styles.daySelected : "",
      isToday && !isSelected ? styles.dayToday : "",
    ]
      .filter(Boolean)
      .join(" ");

    cells.push(
      <button
        key={d}
        type="button"
        className={cls}
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        aria-label={`${d} ${MONTHS_UK[month]} ${year}`}
        aria-pressed={isSelected}
        onClick={() => {
          if (!disabled) onSelect(iso);
        }}
      >
        {d}
      </button>
    );
  }

  return (
    <div className={styles.calendar} role="grid" aria-label="Календар">
      {/* Header: arrows + month/year */}
      <div className={styles.calHeader}>
        <button
          type="button"
          className={styles.calArrow}
          disabled={!canPrev}
          aria-label="Попередній місяць"
          onClick={handlePrev}
        >
          &lsaquo;
        </button>
        <span className={styles.calTitle}>
          {MONTHS_UK[month]} {year}
        </span>
        <button
          type="button"
          className={styles.calArrow}
          disabled={!canNext}
          aria-label="Наступний місяць"
          onClick={handleNext}
        >
          &rsaquo;
        </button>
      </div>

      {/* Weekday labels */}
      <div className={styles.weekRow}>
        {WEEKDAYS_UK.map((wd) => (
          <span key={wd} className={styles.weekLabel}>
            {wd}
          </span>
        ))}
      </div>

      {/* Days */}
      <div className={styles.daysGrid}>{cells}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DatePickerField                                                    */
/* ------------------------------------------------------------------ */

export type DatePickerFieldProps = {
  /** ISO date string YYYY-MM-DD */
  value: string;
  onChange: (iso: string) => void;
  /** Min selectable date (ISO) */
  min?: string;
  /** Max selectable date (ISO) */
  max?: string;
  disabled?: boolean;
  ariaLabel?: string;
  placeholder?: string;
};

export function DatePickerField({
  value,
  onChange,
  min = "",
  max = "",
  disabled = false,
  ariaLabel,
  placeholder = "дд.мм.рррр",
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState(() =>
    value ? formatDisplay(value) : ""
  );
  const [calYear, setCalYear] = useState(() => {
    const p = value ? parseIso(value) : null;
    return p ? p.year : new Date().getFullYear();
  });
  const [calMonth, setCalMonth] = useState(() => {
    const p = value ? parseIso(value) : null;
    return p ? p.month : new Date().getMonth();
  });

  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropPos, setDropPos] = useState<DropPos | null>(null);

  // Sync inputText when value prop changes externally
  useEffect(() => {
    setInputText(value ? formatDisplay(value) : "");
    if (value) {
      const p = parseIso(value);
      if (p) {
        setCalYear(p.year);
        setCalMonth(p.month);
      }
    }
  }, [value]);

  // Position the dropdown
  useLayoutEffect(() => {
    if (!open || !fieldRef.current) {
      setDropPos(null);
      return;
    }
    setDropPos(calcDropPos(fieldRef.current));
  }, [open]);

  // Recalc position on scroll/resize
  useEffect(() => {
    if (!open || !fieldRef.current) return;
    const el = fieldRef.current;
    const update = () => setDropPos(calcDropPos(el));
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    setOpen(true);
  }, [disabled]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const commitValue = useCallback(
    (iso: string) => {
      // Clamp to min/max
      let clamped = iso;
      if (min && clamped < min) clamped = min;
      if (max && clamped > max) clamped = max;
      onChange(clamped);
      setInputText(formatDisplay(clamped));
      const p = parseIso(clamped);
      if (p) {
        setCalYear(p.year);
        setCalMonth(p.month);
      }
    },
    [onChange, min, max]
  );

  const handleCalendarSelect = useCallback(
    (iso: string) => {
      commitValue(iso);
      setOpen(false);
      inputRef.current?.focus();
    },
    [commitValue]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow only digits and dots, max 10 chars
    const filtered = raw.replace(/[^\d.]/g, "").slice(0, 10);
    setInputText(filtered);
  };

  const handleInputBlur = () => {
    if (!inputText.trim()) {
      // Clear
      if (value) onChange("");
      return;
    }
    const iso = parseDisplay(inputText);
    if (iso) {
      commitValue(iso);
    } else {
      // Revert to current value
      setInputText(value ? formatDisplay(value) : "");
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
    }
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      handleOpen();
    }
  };

  const handleMonthChange = useCallback((y: number, m: number) => {
    setCalYear(y);
    setCalMonth(m);
  }, []);

  const dropdown =
    open && dropPos
      ? createPortal(
          <div className={styles.overlay}>
            <button
              type="button"
              className={styles.backdrop}
              aria-label="Закрити календар"
              onClick={handleClose}
              tabIndex={-1}
            />
            <div
              className={styles.dropdown}
              style={{
                top: dropPos.top,
                bottom: dropPos.bottom,
                left: dropPos.left,
                width: dropPos.width,
              }}
            >
              <CalendarGrid
                year={calYear}
                month={calMonth}
                selected={value}
                minDate={min}
                maxDate={max}
                onSelect={handleCalendarSelect}
                onMonthChange={handleMonthChange}
              />
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        ref={fieldRef}
        className={styles.field}
        data-open={open || undefined}
        data-disabled={disabled || undefined}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          className={styles.input}
          value={inputText}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          autoComplete="off"
          onChange={handleInputChange}
          onFocus={handleOpen}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
        />
        <button
          type="button"
          className={styles.iconBtn}
          tabIndex={-1}
          aria-label="Відкрити календар"
          disabled={disabled}
          onMouseDown={(e) => {
            // Prevent blur on input when clicking icon
            e.preventDefault();
            if (open) handleClose();
            else handleOpen();
          }}
        >
          <svg
            className={styles.iconSvg}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>
      {dropdown}
    </>
  );
}
