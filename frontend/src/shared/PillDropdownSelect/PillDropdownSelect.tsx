import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import styles from "./PillDropdownSelect.module.css";

export type PillDropdownOption = {
  value: string;
  label: string;
};

export type PillDropdownSelectProps = {
  value: string;
  options: PillDropdownOption[];
  onChange: (nextValue: string) => void;
  /** Доступна назва кнопки (скрінрідери) */
  ariaLabel: string;
  /** Якщо `value` немає в `options` */
  placeholder?: string;
  className?: string;
  /** Текст пунктів списку — `text-transform: lowercase` (як на макеті) */
  optionsLowercase?: boolean;
  disabled?: boolean;
  /**
   * `form` — без окремої пігулки: текст у стилі полів BookForm, список як у `default`.
   */
  variant?: "default" | "form";
};

type PanelPos = { top: number; left: number; width: number };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function PillDropdownSelect({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "Вибрати",
  className,
  optionsLowercase = false,
  disabled = false,
  variant = "default",
}: PillDropdownSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState<PanelPos>({ top: 0, left: 0, width: 0 });

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const triggerId = `${baseId}-trigger`;

  const selectedIndex = useMemo(() => {
    const i = options.findIndex((o) => o.value === value);
    return i >= 0 ? i : 0;
  }, [options, value]);

  const currentLabel = useMemo(() => {
    const hit = options.find((o) => o.value === value);
    return hit?.label ?? "";
  }, [options, value]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const vw = window.innerWidth;
    const margin = 8;
    const width = clamp(rect.width, 160, vw - margin * 2);
    let left = rect.left;
    left = clamp(left, margin, vw - width - margin);
    let top = rect.bottom + gap;
    const estimatedH = Math.min(420, options.length * 44 + 24);
    if (top + estimatedH > window.innerHeight - margin) {
      top = clamp(rect.top - gap - estimatedH, margin, rect.top - gap);
    }
    setPos({ top, left, width });
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onWin = () => updatePosition();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (listboxRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const openMenu = useCallback(() => {
    if (disabled || options.length === 0) return;
    setHighlight(selectedIndex);
    setOpen(true);
  }, [disabled, options.length, selectedIndex]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const pick = useCallback(
    (index: number) => {
      const opt = options[index];
      if (!opt) return;
      onChange(opt.value);
      closeMenu();
    },
    [closeMenu, onChange, options]
  );

  const onTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + options.length) % options.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlight(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(highlight);
    }
  };

  useEffect(() => {
    if (!open || !listboxRef.current) return;
    const el = listboxRef.current.querySelector<HTMLElement>(
      `[data-option-index="${highlight}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const triggerText = currentLabel || placeholder;

  const rootClass = [
    styles.root,
    variant === "form" ? styles.rootForm : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const triggerClass = [
    styles.trigger,
    variant === "form" ? styles.triggerForm : "",
  ]
    .filter(Boolean)
    .join(" ");

  const portal =
    open && options.length > 0
      ? createPortal(
          <div
            className={styles.listboxWrap}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
            }}
          >
            <ul
              ref={listboxRef}
              id={listboxId}
              className={styles.listbox}
              role="listbox"
              aria-labelledby={triggerId}
            >
              {options.map((opt, i) => {
                const selected = opt.value === value;
                const isHi = i === highlight;
                const optCls = [
                  styles.option,
                  optionsLowercase ? styles.optionLowercase : "",
                  isHi ? styles.optionHighlight : "",
                  selected ? styles.optionSelected : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <li
                    key={opt.value}
                    id={`${listboxId}-opt-${i}`}
                    role="option"
                    aria-selected={selected}
                    data-option-index={i}
                    className={optCls}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => pick(i)}
                  >
                    {opt.label}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={rootClass}>
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        className={triggerClass}
        disabled={disabled || options.length === 0}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open && options[highlight]
            ? `${listboxId}-opt-${highlight}`
            : undefined
        }
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={styles.triggerLabel}>{triggerText}</span>
        <span className={styles.caret} aria-hidden />
      </button>
      {portal}
    </div>
  );
}
