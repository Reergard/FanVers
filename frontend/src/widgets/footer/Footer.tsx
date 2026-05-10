import styles from "./Footer.module.css";
import { Link } from "react-router-dom";
import { Container } from "../../shared/Container";
import { Icon } from "../../shared/Icon";
import logo from "../../assets/logos/logo.png";
import logoKS from "../../assets/logos/LogoKS.svg";
import { openCookieSettingsModal } from "../cookieConsent/CookieConsentManager";

function FacebookGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 16C0 7.16344 7.16344 0 16 0C24.8366 0 32 7.16344 32 16C32 24.8366 24.8366 32 16 32C7.16344 32 0 24.8366 0 16ZM16 8C20.4 8 24 11.6 24 16C24 20 21.1 23.4 17.1 24V18.3H19L19.4 16H17.2V14.5C17.2 13.9 17.5 13.3 18.5 13.3H19.5V11.3C19.5 11.3 18.6 11.1 17.7 11.1C15.9 11.1 14.7 12.2 14.7 14.2V16H12.7V18.3H14.7V23.9C10.9 23.3 8 20 8 16C8 11.6 11.6 8 16 8Z"
        fill="#06ABC1"
      />
    </svg>
  );
}

function InstagramGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M16 18.8C14.5 18.8 13.2 17.6 13.2 16C13.2 14.5 14.4 13.2 16 13.2C17.5 13.2 18.8 14.4 18.8 16C18.8 17.5 17.5 18.8 16 18.8Z"
        fill="#06ABC1"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19.4 9.2H12.6C11.8 9.3 11.4 9.4 11.1 9.5C10.7 9.6 10.4 9.8 10.1 10.1C9.86261 10.3374 9.75045 10.5748 9.61489 10.8617C9.57916 10.9373 9.5417 11.0166 9.5 11.1C9.48453 11.1464 9.46667 11.1952 9.44752 11.2475C9.34291 11.5333 9.2 11.9238 9.2 12.6V19.4C9.3 20.2 9.4 20.6 9.5 20.9C9.6 21.3 9.8 21.6 10.1 21.9C10.3374 22.1374 10.5748 22.2495 10.8617 22.3851C10.9374 22.4209 11.0165 22.4583 11.1 22.5C11.1464 22.5155 11.1952 22.5333 11.2475 22.5525C11.5333 22.6571 11.9238 22.8 12.6 22.8H19.4C20.2 22.7 20.6 22.6 20.9 22.5C21.3 22.4 21.6 22.2 21.9 21.9C22.1374 21.6626 22.2495 21.4252 22.3851 21.1383C22.4209 21.0626 22.4583 20.9835 22.5 20.9C22.5155 20.8536 22.5333 20.8048 22.5525 20.7525C22.6571 20.4667 22.8 20.0762 22.8 19.4V12.6C22.7 11.8 22.6 11.4 22.5 11.1C22.4 10.7 22.2 10.4 21.9 10.1C21.6626 9.86261 21.4252 9.75045 21.1383 9.61488C21.0627 9.57918 20.9833 9.54167 20.9 9.5C20.8536 9.48453 20.8048 9.46666 20.7525 9.44752C20.4667 9.3429 20.0762 9.2 19.4 9.2ZM16 11.7C13.6 11.7 11.7 13.6 11.7 16C11.7 18.4 13.6 20.3 16 20.3C18.4 20.3 20.3 18.4 20.3 16C20.3 13.6 18.4 11.7 16 11.7ZM21.4 11.6C21.4 12.1523 20.9523 12.6 20.4 12.6C19.8477 12.6 19.4 12.1523 19.4 11.6C19.4 11.0477 19.8477 10.6 20.4 10.6C20.9523 10.6 21.4 11.0477 21.4 11.6Z"
        fill="#06ABC1"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 16C0 7.16344 7.16344 0 16 0C24.8366 0 32 7.16344 32 16C32 24.8366 24.8366 32 16 32C7.16344 32 0 24.8366 0 16ZM12.6 7.7H19.4C20.3 7.8 20.9 7.9 21.4 8.1C22 8.4 22.4 8.6 22.9 9.1C23.4 9.6 23.7 10.1 23.9 10.6C24.1 11.1 24.3 11.7 24.3 12.6V19.4C24.2 20.3 24.1 20.9 23.9 21.4C23.6 22 23.4 22.4 22.9 22.9C22.4 23.4 21.9 23.7 21.4 23.9C20.9 24.1 20.3 24.3 19.4 24.3H12.6C11.7 24.2 11.1 24.1 10.6 23.9C10 23.6 9.6 23.4 9.1 22.9C8.6 22.4 8.3 21.9 8.1 21.4C7.9 20.9 7.7 20.3 7.7 19.4V12.6C7.8 11.7 7.9 11.1 8.1 10.6C8.4 10 8.6 9.6 9.1 9.1C9.6 8.6 10.1 8.3 10.6 8.1C11.1 7.9 11.7 7.7 12.6 7.7Z"
        fill="#06ABC1"
      />
    </svg>
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <Container as="footer">
        <div className={styles.desktopOnly}>
          {/* Верхняя строка: 4 колонки */}
          <div className={styles.topGrid}>
            <div className={styles.col}>
              <ul className={styles.list}>
                <li><Link to="/for-copyright-holders" className={styles.link}>Для правовласників</Link></li>
                <li><Link to="/user-agreement" className={styles.link}>Умови використання</Link></li>
                <li><Link to="/privacy-policy" className={styles.link}>Політика компанії щодо обробки персональних даних</Link></li>
                <li><Link to="/cookie-policy" className={styles.link}>Політика cookies</Link></li>
                <li>
                  <button type="button" className={`${styles.link} ${styles.linkButton}`} onClick={openCookieSettingsModal}>
                    Налаштування cookies
                  </button>
                </li>
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
                <li><Link to="/balance-not-credited" className={styles.link}>Не поповнився баланс?</Link></li>
                <li><Link to="/support" className={styles.link}>Написати у підтримку</Link></li>
                <li><Link to="/payment" className={styles.link}>Оплата</Link></li>
              </ul>
            </div>

            <div className={styles.vLine} aria-hidden="true" />

            <div className={styles.side}>
              <div className={styles.social} aria-label="Social links">
                <a className={styles.footerSocialGlyphLink} href="#" aria-label="Facebook">
                  <FacebookGlyph size={34} />
                </a>
                <a className={styles.footerSocialGlyphLink} href="#" aria-label="Instagram">
                  <InstagramGlyph size={34} />
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
        </div>

        {/* Телефон / планшет: сітка як на макеті ~390px */}
        <div className={styles.mobileOnly}>
          <div className={styles.mobileLinkStack}>
            <div className={styles.mobileRow}>
              <div className={`${styles.mobileSpacer} ${styles.mobileSpacerGrad}`} aria-hidden="true" />
              <Link to="/user-agreement" className={styles.mobileTile}>
                <span className={styles.mobileTileLabel}>Угода використання</span>
              </Link>
              <div className={`${styles.mobileSpacer} ${styles.mobileSpacerGrad}`} aria-hidden="true" />
            </div>

            <div className={styles.mobileRow}>
              <div className={`${styles.mobileSpacer} ${styles.mobileSpacerGrad}`} aria-hidden="true" />
              <Link to="/content-rules" className={styles.mobileTile}>
                <span className={styles.mobileTileLabel}>Правила розміщення авторського контенту</span>
              </Link>
              <div className={`${styles.mobileSpacer} ${styles.mobileSpacerGrad}`} aria-hidden="true" />
            </div>

            <div className={styles.mobileRowFull}>
              <Link to="/privacy-policy" className={styles.mobileTileStretch}>
                <span className={styles.mobileTileLabel}>Політика компанії щодо обробки персональних даних</span>
              </Link>
            </div>

            <div className={styles.mobileRow}>
              <Link to="/cookie-policy" className={styles.mobileTile}>
                <span className={styles.mobileTileLabel}>Політика cookies</span>
              </Link>
              <div className={styles.mobileSpacer} aria-hidden="true" />
              <Link to="/contacts" className={styles.mobileTile}>
                <span className={styles.mobileTileLabel}>Контакти</span>
              </Link>
              <div className={styles.mobileSpacer} aria-hidden="true" />
            </div>

            <div className={styles.mobileRowFull}>
              <Link to="/translator-agreement" className={styles.mobileTileStretch}>
                <span className={styles.mobileTileLabel}>Приклад договору між автором та перекладачем</span>
              </Link>
            </div>

            <div className={styles.mobileRow}>
              <Link to="/author-agreement" className={styles.mobileTile}>
                <span className={styles.mobileTileLabel}>Публічний договір з автором</span>
              </Link>
              <div className={`${styles.mobileSpacer} ${styles.mobileSpacerGrad}`} aria-hidden="true" />
              <Link to="/balance-help" className={styles.mobileTile}>
                <span className={styles.mobileTileLabel}>Довідка</span>
              </Link>
            </div>

            <div className={styles.mobileRow}>
              <Link to="/payment" className={styles.mobileTile}>
                <span className={styles.mobileTileLabel}>Оплата</span>
              </Link>
              <div className={`${styles.mobileSpacer} ${styles.mobileSpacerGrad}`} aria-hidden="true" />
              <Link to="/balance-not-credited" className={styles.mobileTile}>
                <span className={styles.mobileTileLabel}>Не поповнився баланс?</span>
              </Link>
            </div>

            <div className={styles.mobileRow}>
              <Link to="/support" className={styles.mobileTile}>
                <span className={styles.mobileTileLabel}>Написати у підтримку</span>
              </Link>
              <Link to="/say-thanks" className={styles.mobileTile}>
                <span className={styles.mobileTileLabel}>Сказати «дякую!»</span>
              </Link>
              <div className={`${styles.mobileSpacer} ${styles.mobileSpacerGrad}`} aria-hidden="true" />
            </div>
          </div>

          <div className={styles.mobileBrandRow}>
            <a className={styles.footerSocialGlyphLink} href="#" aria-label="Facebook">
              <FacebookGlyph size={44} />
            </a>
            <div className={styles.mobileLogosGroup}>
              <Link to="/" className={styles.mobileLogoWrap} aria-label="FanVers">
                <img src={logo} alt="FanVers" className={styles.mobileLogoImg} />
              </Link>
              <div className={styles.mobileLogoWrap}>
                <img src={logoKS} alt="KS" className={styles.mobileLogoImg} />
              </div>
            </div>
            <a className={styles.footerSocialGlyphLink} href="#" aria-label="Instagram">
              <InstagramGlyph size={44} />
            </a>
          </div>

          <p className={styles.mobileAge}>
            Увага! Сайт може містити матеріали, не призначені для перегляду особами, які не досягли 18 років!
          </p>
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
