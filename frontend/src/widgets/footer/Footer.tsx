import styles from "./Footer.module.css";
import { Link } from "react-router-dom";
import { Container } from "../../shared/Container";
import { Icon } from "../../shared/Icon";
import logo from "../../assets/logos/logo.png";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <Container as="footer">
        {/* Верхняя строка: 4 колонки */}
        <div className={styles.topGrid}>
          <div className={styles.col}>
            <ul className={styles.list}>
              <li><Link to="/for-copyright-holders" className={styles.link}>Для правовласників</Link></li>
              <li><Link to="/user-agreement" className={styles.link}>Умови використання</Link></li>
              <li><Link to="/privacy-policy" className={styles.link}>Політика компанії щодо обробки персональних даних</Link></li>
              <li><Link to="/cookie-policy" className={styles.link}>Політика cookies</Link></li>
              <li><Link to="/refund-policy" className={styles.link}>Політика повернень і скасувань</Link></li>
              <li><Link to="/content-rules" className={styles.link}>Правила розміщення авторського контенту</Link></li>
              <li><Link to="/author-agreement" className={styles.link}>Публічний договір з автором</Link></li>
            </ul>
          </div>

          <div className={styles.vLine} aria-hidden="true" />

          <div className={styles.centerLogo}>
            <Link to="/" className={styles.logo} aria-label="FanVers">
              <img src={logo} alt="FanVers" className={styles.logoImg} />
            </Link>
          </div>

          <div className={styles.vLine} aria-hidden="true" />

          <div className={styles.col}>
            <ul className={styles.list}>
              <li><Link to="/balance-help" className={styles.link}>Довідка</Link></li>
              <li><Link to="/translator-agreement" className={styles.link}>Приклад договору: автор і перекладач</Link></li>
              <li><Link to="/say-thanks" className={styles.link}>Сказати дякую!</Link></li>
              <li><Link to="/contacts" className={styles.link}>Контакти</Link></li>
              <li><Link to="/payment" className={styles.link}>Не поповнився баланс?</Link></li>
              <li><Link to="/support" className={styles.link}>Написати у підтримку</Link></li>
              <li><Link to="/payment" className={styles.link}>Оплата</Link></li>
            </ul>
          </div>

          <div className={styles.vLine} aria-hidden="true" />

          <div className={styles.side}>
            <div className={styles.social} aria-label="Social links">
              <a className={styles.socialBtn} href="#" aria-label="Facebook">
                <Icon name="facebook" className={styles.socialIcon} title="Facebook" />
              </a>
              <a className={styles.socialBtn} href="#" aria-label="Instagram">
                <Icon name="instagram-down" className={styles.socialIcon} title="Instagram" />
              </a>
              <a className={styles.socialBtn} href="#" aria-label="YouTube">
                <Icon name="youtube-down" className={styles.socialIcon} title="YouTube" />
              </a>
            </div>

            <p className={styles.age}>
              Увага! Сайт може містити матеріали, не призначені для осіб, які не досягли 18 років!
            </p>
          </div>
        </div>

        {/* Нижняя строка: одна полоса под колонками */}
        <div className={styles.bottomBar} role="contentinfo">
          <p className={styles.copy}>
            © {year} FanVers. Усі права захищені.
          </p>
        </div>
      </Container>
    </footer>
  );
}