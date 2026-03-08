import { useState, useEffect } from "react";
import { Modal } from "../shared/Modal/Modal";
import styles from "./FiltersSidebar.module.css";

const MOBILE_BREAKPOINT = 768;

type Props = {
  children: React.ReactNode;
  /** Додатковий className для sidebar (desktop) */
  sidebarClassName?: string;
};

/**
 * Обгортка для блоку фільтрів.
 * - ПК/ноутбук: sidebar справа (як зараз)
 * - Телефон (<768px): sidebar прихований, фіксована кнопка "Фільтри" (вертикальний текст) справа,
 *   при натисканні — модальне вікно з фільтрами
 */
export function FiltersSidebar({ children, sidebarClassName }: Props) {
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
          title="Фільтри"
          className={styles.filtersModal}
        >
          <div className={styles.filtersModalContent}>{children}</div>
        </Modal>
      )}
    </>
  );
}
