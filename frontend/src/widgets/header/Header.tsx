import styles from "./Header.module.css";
import { Container } from "../../shared/Container";
import { Icon } from "../../shared/Icon";
import { Link } from "react-router-dom";
import { FrameLink } from "../../shared/FrameLink/FrameLink";
import React from "react";
import logo from "../../assets/logos/logo.png";

// Single source of truth
const NAV_MENU = [
  { to: "/catalog", label: "Каталог" },
  { to: "/gd", label: "Чарівни ГД" },
  { to: "/authors", label: "Автори" },
  { to: "/translators", label: "Перекладачі" },
  { to: "/abandoned", label: "Покинуті переклади" },
  { to: "/search", label: "Пошук" },
  { to: "/faq", label: "FAQ" },
];

export function Header() {
  // Потом сюда подцепишь реальные данные (store/api)
  const user = {
    name: "Дмитро Подлуцьк",
    coins: "1959.5",
    notifications: 4,
    messages: 14,
    avatarUrl: "",
  };

  return (
    <header className={styles.header}>
      {/* TOP */}
      <div className={styles.top}>
        <Container className={styles.topInner}>
          {/* ===== Desktop LEFT: Search ===== */}
          <div className={`${styles.left} ${styles.leftDesktop}`}>
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
          <div className={`${styles.left} ${styles.leftCompact}`}>
            <div className={styles.compactLeft}>
              <div
                className={styles.avatar}
                style={user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined}
                aria-hidden="true"
              />

              <div className={styles.compactMeta}>
                <div className={styles.coinsLine}>
                  <span className={styles.coinsLabel}>FanCoins:</span>{" "}
                  <span className={styles.coinsValue}>{user.coins}</span>
                </div>

                <div className={styles.compactActions} aria-label="Сповіщення та повідомлення">
                  <button className={styles.iconBtn} type="button" aria-label="Сповіщення">
                    <span className={styles.badgeWrap}>
                      <Icon name="bell" className={styles.icon} title="Сповіщення" />
                      {user.notifications > 0 ? (
                        <span className={styles.badge} aria-label={`${user.notifications} нових`}>
                          {user.notifications}
                        </span>
                      ) : null}
                    </span>
                  </button>

                  <button className={styles.iconBtn} type="button" aria-label="Повідомлення">
                    <span className={styles.badgeWrap}>
                      <Icon name="mail" className={styles.icon} title="Повідомлення" />
                      {user.messages > 0 ? (
                        <span className={styles.badge} aria-label={`${user.messages} нових`}>
                          {user.messages}
                        </span>
                      ) : null}
                    </span>
                  </button>
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
          <div className={`${styles.right} ${styles.rightDesktop}`}>
            <button className={styles.iconBtn} type="button" aria-label="Сповіщення">
              <span className={styles.badgeWrap}>
                <Icon name="bell" className={styles.icon} title="Сповіщення" />
                {user.notifications > 0 ? <span className={styles.badge}>{user.notifications}</span> : null}
              </span>
            </button>

            <button className={styles.iconBtn} type="button" aria-label="Повідомлення">
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

              <button className={styles.iconBtn} type="button" aria-label="Меню користувача">
                <Icon name="chevron-down" className={styles.chevron} title="Відкрити меню" />
              </button>
            </div>
          </div>

          {/* ===== Compact RIGHT: search + burger (pill) ===== */}
          <div className={`${styles.right} ${styles.rightCompact}`}>
            <button className={styles.iconBtn} type="button" aria-label="Пошук">
              <Icon name="search" className={styles.icon} title="Пошук" />
            </button>

            <button className={styles.burgerPill} type="button" aria-label="Меню">
              <Icon name="burger" className={styles.burgerIcon} title="Меню" />
            </button>
          </div>
        </Container>
      </div>

      {/* NAV */}
      <nav className={styles.nav} aria-label="Навігація">
        <Container className={styles.navInner}>
          {NAV_MENU.map((i, index) => (
            <React.Fragment key={i.to}>
              <FrameLink to={i.to}>
                {i.label}
              </FrameLink>
              {index < NAV_MENU.length - 1 && (
                <Icon name="Star_icon" className={styles.navSeparator} aria-hidden="true" />
              )}
            </React.Fragment>
          ))}
        </Container>
      </nav>
    </header>
  );
}
