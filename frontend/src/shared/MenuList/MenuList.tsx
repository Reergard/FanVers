import React from "react";
import { Link } from "react-router-dom";
import styles from "./MenuList.module.css";
import { Icon } from "../Icon";
import type { MenuItem } from "../menu/menuData";

type Props = {
  items: MenuItem[];
  onSelect?: () => void;
};

export function MenuList({ items, onSelect }: Props) {
  const handleClick = (item: MenuItem, e: React.MouseEvent) => {
    if (item.to === "/logout") {
      e.preventDefault();
      // Здесь можно добавить логику выхода
      console.log("Logout");
    }
    onSelect?.();
  };

  return (
    <ul className={styles.menuList} role="list">
      {items.map((item) => (
        <li key={item.to} className={styles.menuItem}>
          {item.to === "/logout" ? (
            <button
              className={styles.menuLink}
              onClick={(e) => handleClick(item, e)}
              type="button"
            >
              {item.iconName && (
                <Icon name={item.iconName} className={styles.menuIcon} aria-hidden="true" />
              )}
              <span className={styles.menuLabel}>{item.label}</span>
            </button>
          ) : (
            <Link
              to={item.to}
              className={styles.menuLink}
              onClick={onSelect}
            >
              {item.iconName && (
                <Icon name={item.iconName} className={styles.menuIcon} aria-hidden="true" />
              )}
              <span className={styles.menuLabel}>{item.label}</span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
