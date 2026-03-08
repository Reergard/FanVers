import { useState, useEffect } from "react";
import { Modal } from "../shared/Modal/Modal";
import styles from "./FiltersSidebar.module.css";

const MOBILE_BREAKPOINT = 768;

type Props = {
  children: React.ReactNode;
  /** Контент для модалки (якщо відрізняється від sidebar). Якщо задано — у модалці рендериться це, а не children */
  modalChildren?: React.ReactNode;
  /** Додатковий className для sidebar (desktop) */
  sidebarClassName?: string;
  /** Додатковий className для модалки (Modal) */
  modalClassName?: string;
  /** Додатковий className для контенту в модалці (mobile) */
  modalContentClassName?: string;
  /** Додатковий className для кнопки закриття (коли hideModalTitle) */
  modalCloseBtnClassName?: string;
  /** Приховати заголовок модалки (коли заголовок всередині контенту) */
  hideModalTitle?: boolean;
  /** Заголовок модалки (за замовчуванням "Фільтри") */
  modalTitle?: string;
};

/**
 * Обгортка для блоку фільтрів.
 * - ПК/ноутбук: sidebar справа (як зараз)
 * - Телефон (<768px): sidebar прихований, фіксована кнопка "Фільтри" (вертикальний текст) справа,
 *   при натисканні — модальне вікно з фільтрами
 */
export function FiltersSidebar({
  children,
  modalChildren,
  sidebarClassName,
  modalClassName,
  modalContentClassName,
  modalCloseBtnClassName,
  hideModalTitle = false,
  modalTitle = "Фільтри",
}: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <>
      {/* Desktop: sidebar як зараз */}
      <aside
        className={`${styles.sidebar} ${isMobile ? styles.sidebarHidden : ""} ${sidebarClassName ?? ""}`}
        aria-hidden={isMobile}
      >
        {children}
      </aside>

      {/* Mobile: фіксована кнопка справа з вертикальним текстом */}
      {isMobile && (
        <button
          type="button"
          className={styles.filtersFloatingBtn}
          onClick={() => setModalOpen(true)}
          aria-label="Відкрити фільтри"
        >
          <span className={styles.filtersFloatingText}>
            {"Фільтри".split("").map((letter, i) => (
              <span key={i} className={styles.filtersFloatingLetter}>
                {letter}
              </span>
            ))}
          </span>
        </button>
      )}

      {/* Mobile: модальне вікно з фільтрами */}
      {isMobile && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={hideModalTitle ? undefined : modalTitle}
          className={`${styles.filtersModal} ${modalClassName ?? ""}`.trim()}
          showCloseButton={!hideModalTitle}
        >
          <div
            className={`${styles.filtersModalContent} ${modalContentClassName ?? ""}`.trim()}
          >
            {hideModalTitle && (
              <button
                type="button"
                className={`${styles.modalCloseBtn} ${modalCloseBtnClassName ?? ""}`.trim()}
                onClick={() => setModalOpen(false)}
                aria-label="Закрити"
              >
                ×
              </button>
            )}
            {modalChildren ?? children}
          </div>
        </Modal>
      )}
    </>
  );
}
