import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "../shared/hooks/useScrollLock";
import styles from "./FilterDropdown.module.css";

type DropdownPosition = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  minWidth: number;
  maxWidth: number;
  maxHeight: number;
};

type Align = "start" | "end";

type FilterDropdownProps = {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  sideOffset?: number;
  align?: Align;
  maxWidth?: number;
};

function getPosition(
  anchorEl: HTMLElement,
  sideOffset: number,
  align: Align,
  maxWidth?: number
): DropdownPosition {
  const rect = anchorEl.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const viewportPadding = 12;
  const computedMaxWidth = Math.min(maxWidth ?? Math.floor(viewportWidth * 0.5), viewportWidth - viewportPadding * 2);
  const minWidth = Math.min(Math.max(rect.width, 280), viewportWidth - viewportPadding * 2);
  const spaceBelow = viewportHeight - (rect.bottom + sideOffset) - viewportPadding;
  const spaceAbove = rect.top - sideOffset - viewportPadding;
  const shouldOpenBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(160, shouldOpenBelow ? spaceBelow : spaceAbove);

  const verticalPosition = shouldOpenBelow
    ? { top: rect.bottom + sideOffset }
    : { bottom: viewportHeight - rect.top + sideOffset };

  if (align === "end") {
    const rawRight = viewportWidth - rect.right;
    const maxRight = viewportWidth - viewportPadding - minWidth;
    const right = Math.max(viewportPadding, Math.min(rawRight, maxRight));
    return {
      ...verticalPosition,
      right,
      minWidth,
      maxWidth: computedMaxWidth,
      maxHeight,
    };
  }

  let left = rect.left;
  left = Math.max(viewportPadding, Math.min(left, viewportWidth - viewportPadding - minWidth));

  return {
    ...verticalPosition,
    left,
    minWidth,
    maxWidth: computedMaxWidth,
    maxHeight,
  };
}

export function FilterDropdown({
  open,
  anchorEl,
  onClose,
  children,
  className,
  sideOffset = 8,
  align = "end",
  maxWidth,
}: FilterDropdownProps) {
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  useScrollLock(open);

  const panelClassName = useMemo(
    () => [styles.panel, className ?? ""].filter(Boolean).join(" "),
    [className]
  );

  useLayoutEffect(() => {
    if (!open || !anchorEl) {
      setPosition(null);
      return;
    }
    const next = getPosition(anchorEl, sideOffset, align, maxWidth);
    setPosition(next);
  }, [open, anchorEl, sideOffset, align, maxWidth]);

  useEffect(() => {
    if (!open || !anchorEl) return;

    const update = () => {
      setPosition(getPosition(anchorEl, sideOffset, align, maxWidth));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, anchorEl, sideOffset, align, maxWidth, onClose]);

  if (!open || !anchorEl || !position) return null;

  return createPortal(
    <div className={styles.root}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Закрити випадаючий список"
        onClick={onClose}
      />
      <div
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        style={{
          top: position.top,
          bottom: position.bottom,
          left: position.left,
          right: position.right,
          minWidth: position.minWidth,
          maxWidth: position.maxWidth,
          maxHeight: position.maxHeight,
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

