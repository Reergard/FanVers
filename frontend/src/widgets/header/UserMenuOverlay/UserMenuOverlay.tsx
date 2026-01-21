import React, { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import styles from "./UserMenuOverlay.module.css";
import { MenuPanel } from "../../../shared/MenuPanel/MenuPanel";
import { useMedia } from "../../../shared/hooks/useMedia";
import { useScrollLock } from "../../../shared/hooks/useScrollLock";
import type { MenuItem } from "../../../shared/menu/menuData";

type Props = {
  open: boolean;
  mode: "popover" | "drawer";
  anchorRef: React.RefObject<HTMLElement | null>;
  items: MenuItem[];
  onClose: () => void;
  menuId: string;
  name: string;
  avatarUrl?: string;
};

export function UserMenuOverlay({
  open,
  mode,
  anchorRef,
  items,
  onClose,
  menuId,
  name,
  avatarUrl,
}: Props) {
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Блокируем скролл только в drawer режиме
  useScrollLock(open && mode === "drawer");

  // Закрываем при изменении роута
  const prevPathnameRef = useRef(location.pathname);
  useEffect(() => {
    const changed = prevPathnameRef.current !== location.pathname;
    prevPathnameRef.current = location.pathname;

    if (open && changed) {
      onClose();
    }
  }, [location.pathname, open, onClose]);

  // Закрываем по Esc
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

    // Фокусируемся на панели
    requestAnimationFrame(() => {
      if (panelRef.current) {
        const firstFocusable = panelRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          panelRef.current.focus();
        }
      }
    });

    return () => {
      // Возвращаем фокус при закрытии
      requestAnimationFrame(() => {
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        } else if (anchorRef.current) {
          anchorRef.current.focus();
        }
      });
    };
  }, [open, anchorRef]);

  // Закрытие по клику вне меню
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      if (mode === "drawer") {
        // В drawer режиме закрываем по клику на overlay
        if (panelRef.current && !panelRef.current.contains(target)) {
          onClose();
        }
      } else {
        // В popover режиме закрываем по клику вне панели и вне якоря
        if (
          panelRef.current &&
          !panelRef.current.contains(target) &&
          anchorRef.current &&
          !anchorRef.current.contains(target)
        ) {
          onClose();
        }
      }
    };

    // Небольшая задержка, чтобы не закрыть сразу при открытии
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, mode, onClose, anchorRef]);

  const handleSelect = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  const isDrawer = mode === "drawer";

  return (
    <>
      {/* Overlay для drawer */}
      {isDrawer && (
        <div
          className={styles.overlay}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Панель меню */}
      <div
        ref={panelRef}
        id={menuId}
        className={`${styles.panel} ${isDrawer ? styles.panelDrawer : styles.panelPopover}`}
        role={isDrawer ? "dialog" : "menu"}
        aria-modal={isDrawer ? "true" : undefined}
        aria-label="Меню користувача"
        tabIndex={-1}
      >
        <MenuPanel
          name={name}
          avatarUrl={avatarUrl}
          items={items}
          onSelect={handleSelect}
        />
      </div>
    </>
  );
}
