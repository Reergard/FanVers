import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "../hooks/useScrollLock";
import styles from "./Modal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** Показувати кнопку закриття (×). За замовчуванням true */
  showCloseButton?: boolean;
};

export function Modal({ open, onClose, title, children, className, showCloseButton = true }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Блокируем скролл при открытии
  useScrollLock(open);

  // Закрытие по Esc
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Управление фокусом
  useEffect(() => {
    if (!open) return;

    // Сохраняем предыдущий фокус
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Фокусируемся на модалке
    requestAnimationFrame(() => {
      if (modalRef.current) {
        const firstFocusable = modalRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          modalRef.current.focus();
        }
      }
    });

    return () => {
      // Возвращаем фокус при закрытии
      requestAnimationFrame(() => {
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      });
    };
  }, [open]);

  if (!open) return null;

  const modalClassName = [styles.modal, className].filter(Boolean).join(" ");

  const modalContent = (
    <>
      <div
        className={styles.overlay}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        className={modalClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className={styles.titleRow}>
            <h2 id="modal-title" className={styles.title}>
              {title}
            </h2>
            {showCloseButton && (
              <button
                type="button"
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Закрити"
              >
                ×
              </button>
            )}
          </div>
        )}
        <div className={styles.content}>{children}</div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
