import styles from "./Header.module.css";
import { Container } from "../../shared/Container";
const NAV = [
  { to: "/catalog", label: "Каталог" },
  { to: "/gd", label: "Царівни ГД" },
  { to: "/authors", label: "Автори" },
  { to: "/translators", label: "Перекладачі" },
  { to: "/search", label: "Пошук" },
  { to: "/faq", label: "FAQ" },
];
export function Header() {
  return (
    <header className={styles.header}>
      {/* TOP */}
      <div className={styles.top}>
        <Container className={styles.topInner}>
          <div className={styles.left}>
            <div className={styles.search}>
              <input className={styles.searchInput} placeholder="Пошук по сайту" />
              <button className={styles.iconBtn} aria-label="Search">🔍</button>
            </div>
          </div>
          <div className={styles.center}>
            <div className={styles.logo}>LOGO</div>
          </div>
          <div className={styles.right}>
            <button className={styles.iconBtn} aria-label="Notifications">🔔</button>
            <button className={styles.iconBtn} aria-label="Messages">✉️</button>
            <div className={styles.user}>
              <div className={styles.avatar} />
              <div className={styles.userText}>
                <div className={styles.userName}>Дмитро Подлуцьк</div>
                <div className={styles.userCoins}>FanCoins: 1295.5</div>
              </div>
              <button className={styles.iconBtn} aria-label="User menu">▾</button>
            </div>
            <button className={styles.burger} aria-label="Menu">☰</button>
          </div>
        </Container>
      </div>
      {/* NAV (остается и на мобиле) */}
      <nav className={styles.nav}>
        <Container className={styles.navInner}>
          {NAV.map((i) => (
            <a key={i.to} href={i.to} className={styles.navLink}>
              {i.label}
            </a>
          ))}
        </Container>
      </nav>
    </header>
  );
}
