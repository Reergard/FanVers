import styles from "./Header.module.css";
import { Container } from "../../shared/Container";
import { Icon } from "../../shared/Icon";
import { Link } from "react-router-dom";
import { FrameLink } from "../../shared/FrameLink/FrameLink";
import React, { useState, useRef, useCallback, useEffect } from "react";
import logo from "../../assets/logos/logo.png";
import backBalance from "../../assets/backgrounds/back_balance.svg";
import { UserMenuOverlay } from "./UserMenuOverlay/UserMenuOverlay";
import { USER_MENU } from "../../shared/menu/menuData";
import { useMedia } from "../../shared/hooks/useMedia";
import { useAuth } from "../../auth/useAuth";

// Single source of truth (Desktop)
const NAV_MENU_OLD = [
  { to: "/catalog", label: "Каталог" },
  { to: "/gd", label: "Чарівний Гід" },
  { to: "/authors", label: "Автори" },
  { to: "/translators", label: "Перекладачі" },
  { to: "/abandoned", label: "Покинуті переклади" },
  { to: "/search", label: "Пошук" },
  { to: "/faq", label: "FAQ" },
];

// Tablet/Mobile: навигация в 2 строки
const NAV_ROW_1 = [
  { to: "/catalog", label: "Каталог" },
  { to: "/gd", label: "Чарівний Гід" },
  { to: "/abandoned", label: "Покинуті переклади" },
];

const NAV_ROW_2 = [
  { to: "/translators", label: "Перекладачі" },
  { to: "/authors", label: "Автори" },
  { to: "/search", label: "Пошук" },
  { to: "/faq", label: "FAQ" },
];

export function Header() {
  const { isAuthenticated, username, balance } = useAuth();

  const user = {
    name: isAuthenticated ? (username ?? "Користувач") : "Гість",
    coins: isAuthenticated ? (balance ?? "0") : "0",
    notifications: 4,
    messages: 14,
    avatarUrl: "",
  };

  // Состояние меню
  const [menuOpen, setMenuOpen] = useState(false);
  const lastTriggerRef = useRef<"dropdown" | "burger">("dropdown");

  // Refs для кнопок
  const dropdownBtnRef = useRef<HTMLButtonElement>(null);
  const burgerBtnRef = useRef<HTMLButtonElement>(null);

  // Определяем режим (mobile/tablet <= 1024px) - синхронизировано с CSS
  const isMobile = useMedia("(max-width: 1024px)");
  // Определяем tablet/mobile для навигации в 2 строки
  const isTablet = useMedia("(max-width: 1024px)");

  // Определяем контент меню
  const menuItems = USER_MENU;
  const mode = isMobile ? "drawer" : "popover";
  const anchorRef = isMobile ? burgerBtnRef : dropdownBtnRef;

  // Закрываем меню при изменении breakpoint
  const prevIsMobileRef = useRef(isMobile);
  useEffect(() => {
    if (prevIsMobileRef.current !== isMobile) {
      prevIsMobileRef.current = isMobile;
      setMenuOpen(false);
    }
  }, [isMobile]);

  // Обработчики открытия
  const openFromDropdown = useCallback(() => {
    lastTriggerRef.current = "dropdown";
    setMenuOpen(true);
  }, []);

  const openFromBurger = useCallback(() => {
    lastTriggerRef.current = "burger";
    setMenuOpen(true);
  }, []);

  // Обработчик закрытия
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    // Возвращаем фокус на кнопку
    requestAnimationFrame(() => {
      const targetBtn = lastTriggerRef.current === "burger" 
        ? burgerBtnRef.current 
        : dropdownBtnRef.current;
      targetBtn?.focus();
    });
  }, []);

  const menuId = "user-menu";

  return (
    <header className={styles.header}>
      {/* TOP */}
      <div className={styles.top}>
        <Container className={styles.topInner}>
          {/* ===== Desktop LEFT: Search ===== */}
          <div className={[styles.left, styles.leftDesktop].filter(Boolean).join(" ")}>
            <form className={styles.search} role="search" aria-label="Пошук по сайту">
              <label className={styles.searchField}>
                <span className={styles.searchLabel}>Пошук по сайту</span>
                <input
                  className={styles.searchInput}
                  type="search"
                  name="q"
                  autoComplete="off"
                  placeholder=""
                />
              </label>

              <button className={styles.iconBtn} type="submit" aria-label="Знайти">
                <Icon name="search" className={styles.icon} title="Пошук" />
              </button>
            </form>
          </div>

          {/* ===== Compact LEFT: Avatar + (bell/mail) + FanCoins ===== */}
          {/* Блок всегда рендерится для сохранения места в разметке */}
          <div className={[styles.left, styles.leftCompact].filter(Boolean).join(" ")}>
            <div className={styles.compactLeft}>
              {/* Всегда рендерим структуру, но скрываем если не авторизован */}
              <div
                className={styles.avatar}
                style={{
                  ...(user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : {}),
                  visibility: isAuthenticated ? "visible" : "hidden",
                }}
                aria-hidden="true"
              />

              <div className={styles.compactMeta} style={{ visibility: isAuthenticated ? "visible" : "hidden" }}>
                <div className={styles.compactActions} aria-label="Сповіщення та повідомлення">
                  <button className={styles.iconBtn} type="button" aria-label="Сповіщення" disabled={!isAuthenticated}>
                    <span className={styles.badgeWrap}>
                      <Icon name="bell" className={styles.icon} title="Сповіщення" />
                      {isAuthenticated && user.notifications > 0 ? (
                        <span className={styles.badge} aria-label={`${user.notifications} нових`}>
                          {user.notifications}
                        </span>
                      ) : null}
                    </span>
                  </button>

                  <button className={styles.iconBtn} type="button" aria-label="Повідомлення" disabled={!isAuthenticated}>
                    <span className={styles.badgeWrap}>
                      <Icon name="mail" className={styles.icon} title="Повідомлення" />
                      {isAuthenticated && user.messages > 0 ? (
                        <span className={styles.badge} aria-label={`${user.messages} нових`}>
                          {user.messages}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </div>

                <div className={styles.coinsLine}>
                  <span className={styles.coinsLabel}>FanCoins:</span>{" "}
                  <span className={styles.coinsValue}>{user.coins}</span>
                  <Icon name="back_balance" className={styles.balanceGlow} aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>

          {/* CENTER: Logo */}
          <div className={styles.center}>
            <Link to="/" className={styles.logo} aria-label="FanVers">
              <img src={logo} alt="FanVers" className={styles.logoImg} />
            </Link>
          </div>

          {/* ===== Desktop RIGHT: bell/mail + user dropdown ===== */}
          <div className={[styles.right, styles.rightDesktop].filter(Boolean).join(" ")}>
            <button
              className={styles.iconBtn}
              type="button"
              aria-label="Сповіщення"
              style={{ visibility: isAuthenticated ? "visible" : "hidden" }}
            >
              <span className={styles.badgeWrap}>
                <Icon name="bell" className={styles.icon} title="Сповіщення" />
                {user.notifications > 0 ? <span className={styles.badge}>{user.notifications}</span> : null}
              </span>
            </button>

            <button
              className={styles.iconBtn}
              type="button"
              aria-label="Повідомлення"
              style={{ visibility: isAuthenticated ? "visible" : "hidden" }}
            >
              <span className={styles.badgeWrap}>
                <Icon name="mail" className={styles.icon} title="Повідомлення" />
                {user.messages > 0 ? <span className={styles.badge}>{user.messages}</span> : null}
              </span>
            </button>

            <div className={styles.user}>
              <div
                className={styles.avatar}
                style={user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined}
                aria-hidden="true"
              />
              <div className={styles.userText}>
                <div className={styles.userName}>{user.name}</div>
                <div className={styles.userCoins}>
                  <span className={styles.coinsLabel}>FanCoins:</span>{" "}
                  <span className={styles.userCoinsValue}>{user.coins}</span>
                </div>
              </div>

              <button
                ref={dropdownBtnRef}
                className={styles.iconBtn}
                type="button"
                aria-label="Меню користувача"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={openFromDropdown}
              >
                <Icon name="chevron-down" className={styles.chevron} title="Відкрити меню" />
              </button>
            </div>
          </div>

          {/* ===== Compact RIGHT: search + burger (pill) ===== */}
          <div className={[styles.right, styles.rightCompact].filter(Boolean).join(" ")}>
            <button className={`${styles.iconBtn} ${styles.searchMini}`} type="button" aria-label="Пошук">
              <Icon name="search" className={styles.icon} title="Пошук" />
            </button>

            <button
              ref={burgerBtnRef}
              className={styles.burgerPill}
              type="button"
              aria-label="Меню"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={openFromBurger}
            >
              <Icon name="burger" className={styles.burgerIcon} title="Меню" />
            </button>
          </div>
        </Container>
      </div>

      {/* NAV */}
      <nav className={styles.nav} aria-label="Навігація">
        <Container>
          {isTablet ? (
            <div className={styles.navRows}>
              <div className={styles.navRow}>
                {NAV_ROW_1.map((i, idx) => (
                  <React.Fragment key={i.to}>
                    <FrameLink to={i.to}>{i.label}</FrameLink>
                    {idx < NAV_ROW_1.length - 1 && (
                      <Icon name="Star_icon" className={styles.navSeparator} aria-hidden="true" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              <div className={styles.navRow}>
                {NAV_ROW_2.map((i, idx) => (
                  <React.Fragment key={i.to}>
                    <FrameLink to={i.to}>{i.label}</FrameLink>
                    {idx < NAV_ROW_2.length - 1 && (
                      <Icon name="Star_icon" className={styles.navSeparator} aria-hidden="true" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.navInner}>
              {NAV_MENU_OLD.map((i, index) => (
                <React.Fragment key={i.to}>
                  <FrameLink to={i.to}>{i.label}</FrameLink>
                  {index < NAV_MENU_OLD.length - 1 && (
                    <Icon name="Star_icon" className={styles.navSeparator} aria-hidden="true" />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </Container>
      </nav>

      {/* User Menu Overlay */}
      <UserMenuOverlay
        open={menuOpen}
        mode={mode}
        anchorRef={anchorRef}
        items={menuItems}
        onClose={closeMenu}
        menuId={menuId}
        name={user.name}
        avatarUrl={user.avatarUrl}
        isAuthenticated={isAuthenticated}
      />
    </header>
  );
}