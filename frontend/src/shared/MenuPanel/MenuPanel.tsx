import { Link } from "react-router-dom";
import styles from "./MenuPanel.module.css";
import { AvatarOrbit } from "../AvatarOrbit/AvatarOrbit";
import { MenuList } from "../MenuList/MenuList";
import { Icon } from "../Icon";
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
      {/* Аватар с орбитой */}
      <div className={styles.avatarSection}>
        <AvatarOrbit avatarUrl={avatarUrl} name={name} />
      </div>

      {/* Имя пользователя */}
      <div className={styles.nameSection}>
        <h2 className={styles.userName}>{name}</h2>
      </div>

      {/* CTA кнопка с рамкой — переход на сторінку створення книги */}
      <div className={styles.ctaSection}>
        <Link to="/create-book" className={styles.ctaButton} onClick={onSelect}>
          {/* рамка */}
          <Icon name="menu_frame" className={styles.ctaFrame} aria-hidden="true" />

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
