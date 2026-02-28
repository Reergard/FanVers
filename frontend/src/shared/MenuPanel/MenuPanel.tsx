import { Link } from "react-router-dom";
import styles from "./MenuPanel.module.css";
import { AvatarOrbit } from "../AvatarOrbit/AvatarOrbit";
import { MenuList } from "../MenuList/MenuList";
import { MenuFrameSvg } from "../MenuFrameSvg/MenuFrameSvg";
import type { MenuItem } from "../menu/menuData";

type Props = {
  name: string;
  avatarUrl?: string;
  items: MenuItem[];
  onSelect?: () => void;
};

export function MenuPanel({ name, avatarUrl, items, onSelect }: Props) {
  return (
    <div className={styles.menuPanel}>
      {/* Аватар с орбитой — 1:1 як у гостевому меню */}
      <div className={styles.avatarOrbit}>
        <AvatarOrbit avatarUrl={avatarUrl} name={name} variant="fullWidth" />
      </div>

      {/* Имя пользователя */}
      <div className={styles.nameSection}>
        <h2 className={styles.userName}>{name}</h2>
      </div>

      {/* CTA кнопка с рамкой — переход на сторінку створення книги */}
      <div className={styles.ctaSection}>
        <Link to="/create-book" className={styles.ctaButton} onClick={onSelect}>
          {/* рамка */}
          <MenuFrameSvg className={styles.ctaFrame} />

          {/* контент */}
          <span className={styles.ctaContent}>
            <svg className={styles.ctaIcon} aria-hidden="true">
              <use href="#feather" />
            </svg>
            <span className={styles.ctaText}>Створити книгу</span>
          </span>
        </Link>
      </div>

      {/* Список меню */}
      <div className={styles.menuSection}>
        <MenuList items={items} onSelect={onSelect} />
      </div>
    </div>
  );
}
