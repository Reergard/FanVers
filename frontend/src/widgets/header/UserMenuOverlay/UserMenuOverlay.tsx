import React, { useEffect, useRef, useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import styles from "./UserMenuOverlay.module.css";
import { MenuPanel } from "../../../shared/MenuPanel/MenuPanel";
import { useMedia } from "../../../shared/hooks/useMedia";
import { useScrollLock } from "../../../shared/hooks/useScrollLock";
import type { MenuItem } from "../../../shared/menu/menuData";
import { ActionButton } from "../../../shared/ActionButton/ActionButton";
import { Modal } from "../../../shared/Modal/Modal";
import { LoginForm } from "../../../auth/LoginForm";
import { RegisterForm } from "../../../auth/RegisterForm";

type Props = {
  open: boolean;
  mode: "popover" | "drawer";
  anchorRef: React.RefObject<HTMLElement | null>;
  items: MenuItem[];
  onClose: () => void;
  menuId: string;
  name: string;
  avatarUrl?: string;
  isAuthenticated: boolean;
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
  isAuthenticated,
}: Props) {
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);

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

  // Закрытие по клику вне меню (только для popover режима)
  // В drawer режиме закрытие делается только через overlay onClick и Esc
  useEffect(() => {
    if (!open || mode === "drawer") return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      // В popover режиме закрываем по клику вне панели и вне якоря
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
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

  const handleLoginSuccess = useCallback(() => {
    setLoginModalOpen(false);
    onClose();
    // Состояние обновится реактивно через useAuth в Header
  }, [onClose]);

  const handleRegisterSuccess = useCallback(() => {
    setRegisterModalOpen(false);
    onClose();
    // Состояние обновится реактивно через useAuth в Header
  }, [onClose]);

  const isDrawer = mode === "drawer";

  return (
    <>
      {/* Overlay и панель меню - только когда open */}
      {open && (
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
            {isAuthenticated ? (
              <MenuPanel
                name={name}
                avatarUrl={avatarUrl}
                items={items}
                onSelect={handleSelect}
              />
            ) : (
              <div className={styles.authButtons}>
                <div className={styles.authTitle}>Вхід / Реєстрація</div>
                <div className={styles.authActions}>
                  <ActionButton
                    onClick={() => {
                      setLoginModalOpen(true);
                      onClose();
                    }}
                    className={styles.authButton}
                  >
                    Вхід
                  </ActionButton>
                  <ActionButton
                    onClick={() => {
                      setRegisterModalOpen(true);
                      onClose();
                    }}
                    className={styles.authButton}
                  >
                    Реєстрація
                  </ActionButton>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Модалки логина и регистрации - всегда рендерятся, независимо от open */}
      <Modal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        title="Вхід"
      >
        <LoginForm onSuccess={handleLoginSuccess} />
      </Modal>

      <Modal
        open={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        title="Реєстрація"
      >
        <RegisterForm onSuccess={handleRegisterSuccess} />
      </Modal>
    </>
  );
}
