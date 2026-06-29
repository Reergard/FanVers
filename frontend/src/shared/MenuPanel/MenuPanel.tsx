import { OverflowMarqueeText } from "../OverflowMarqueeText/OverflowMarqueeText";
import { Link } from "react-router-dom";
import styles from "./MenuPanel.module.css";
import { AvatarOrbit } from "../AvatarOrbit/AvatarOrbit";
import { MenuList } from "../MenuList/MenuList";
import { MenuFrameSvg } from "../MenuFrameSvg/MenuFrameSvg";
import type { MenuItem } from "../menu/menuData";

/** CTA «Створити книгу»: creator — Link; reader — модалка; loading — поки роль невідома */
export type CreateBookCtaMode = "loading" | "reader" | "creator";

type Props = {
  name: string;
  avatarUrl?: string;
  items: MenuItem[];
  onSelect?: () => void;
  createBookCtaMode: CreateBookCtaMode;
  /** Для reader/loading (після завантаження null трактуємо як читача); обовʼязково, щоб не було мовчазного кліку */
  onReaderCreateBook: () => void;
};

export function MenuPanel({
  name,
  avatarUrl,
  items,
  onSelect,
  createBookCtaMode,
  onReaderCreateBook,
}: Props) {
  const ctaLabel =
    createBookCtaMode === "loading" ? "Завантаження…" : "Створити книгу";

  const ctaInner = (
    <>
      <MenuFrameSvg className={styles.ctaFrame} />
      <span className={styles.ctaContent}>
        <svg className={styles.ctaIcon} aria-hidden="true">
          <use href="#feather" />
        </svg>
        <span className={styles.ctaText}>{ctaLabel}</span>
      </span>
    </>
  );

  return (
    <div className={styles.menuPanel}>
      {/* Аватар с орбитой — 1:1 як у гостевому меню */}
      <div className={styles.avatarOrbit}>
        <AvatarOrbit avatarUrl={avatarUrl} name={name} variant="fullWidth" />
      </div>

      {/* Имя пользователя */}
      <div className={styles.nameSection}>
        <h2 className={styles.userName}>
          <OverflowMarqueeText text={name} />
        </h2>
      </div>

      {/* CTA кнопка с рамкой — переход на сторінку створення книги */}
      <div className={styles.ctaSection}>
        {createBookCtaMode === "creator" ? (
          <Link to="/create-book" className={styles.ctaButton} onClick={onSelect}>
            {ctaInner}
          </Link>
        ) : (
          <button
            type="button"
            className={`${styles.ctaButton} ${createBookCtaMode === "loading" ? styles.ctaButtonLoading : ""}`}
            onClick={() => {
              if (createBookCtaMode === "loading") return;
              onReaderCreateBook();
            }}
            disabled={createBookCtaMode === "loading"}
            aria-busy={createBookCtaMode === "loading"}
            aria-haspopup={createBookCtaMode === "reader" ? "dialog" : undefined}
          >
            {ctaInner}
          </button>
        )}
      </div>

      {/* Список меню */}
      <div className={styles.menuSection}>
        <MenuList items={items} onSelect={onSelect} />
      </div>
    </div>
  );
}
