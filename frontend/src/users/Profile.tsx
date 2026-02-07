import { useState } from "react";
import styles from "./Profile.module.css";
import crownSvg from "./assets/icons/crown.svg";
import turnedOffView from "./assets/icons/turned_off_view.svg";
import includedView from "./assets/icons/included_view.svg";
import saveSvg from "./assets/icons/Save.svg";
import crystalProfile from "./assets/icons/crysral_profile.svg";

export default function Profile() {
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  return (
    <section className={styles.page}>
      <div className={styles.wrap}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>ПРОФІЛЬ</h1>

          <div className={styles.loginBlock}>
            <img
              src={crownSvg}
              className={styles.crown}
              alt=""
              width={61}
              height={40}
              aria-hidden="true"
            />
            <div className={styles.loginRow}>
              <span className={styles.loginLabel}>Логін:</span>
              <span className={styles.loginValue}>Дмитро Поліщук</span>
            </div>
          </div>

          <div className={styles.headerLine} aria-hidden="true" />
        </header>

        {/* Top block: avatar (left) + about/stats/balance (right) */}
        <div className={styles.topGrid}>
          {/* Left: Avatar only */}
          <aside className={styles.leftTop}>
            <div className={styles.avatarCard}>
              <div className={styles.avatarOrbit} aria-hidden="true" />
              <div className={styles.avatarFrame}>
                {/* TODO: заменить src на реальный аватар + srcSet/sizes */}
                <img
                  className={styles.avatarImg}
                  src="https://via.placeholder.com/320x420.png?text=Avatar"
                  alt="Фото профілю"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </aside>

          {/* Right: About + Stats + Balance row */}
          <section className={styles.rightTop}>
            {/* About */}
            <div className={styles.about}>
              <div className={styles.aboutHead}>
                <span className={styles.aboutLabel}>Про себе:</span>
              </div>

              <p className={styles.aboutText}>
                Вітання. Добро пожалувати в систему перекладів «UA Translate».
                Цей сайт призначений для професійних мов, любительських перекладів
                будь-яких новелів, фанфіків, роботи з різних мов.
              </p>

              <p className={styles.aboutText}>
                Вітання. Добро пожалувати в систему перекладів «UA Translate».
                Цей сайт призначений для професійних мов, любительських перекладів
                будь-яких новелів, фанфіків, роботи з різних мов.
              </p>

              <a className={styles.linkCyan} href="#edit-about">
                Змінити
              </a>
            </div>

            <div className={styles.sectionLine} aria-hidden="true" />

            {/* Stats table */}
            <div className={styles.stats}>
              <div className={styles.statsHeaderRow}>
                <div className={styles.statsHeaderLeft}>
                  <span className={styles.statsKey}>Тип профілю:</span>
                  <span className={styles.statsVal}>Читач</span>
                </div>

                <a className={styles.linkCyan} href="#become-translator">
                  Стати перекладачем
                </a>
              </div>

              <div className={styles.statsRows}>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>
                    Загальна кількість перекладених символів:
                  </span>
                  <span className={styles.statValue}>5059105</span>
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Загальна кількість розділів:</span>
                  <span className={styles.statValue}>159</span>
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Загальна кількість безкоштовних розділів:</span>
                  <span className={styles.statValue}>15</span>
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Середній рейтинг перекладів:</span>
                  <span className={styles.statValue}>5</span>
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Кількість авторських книжок:</span>
                  <span className={styles.statValue}>5</span>
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Кількість перекладів:</span>
                  <span className={styles.statValue}>5</span>
                </div>
              </div>
            </div>
          </section>

          {/* Full-width line after stats (under avatar, above buttons) */}
          <div className={styles.sectionLineFull} aria-hidden="true" />

          {/* Left: action buttons (below the line) */}
          <div className={styles.leftButtons}>
            <button type="button" className={styles.btnOutlineGold}>
              Змінити фото профілю
            </button>
            <button type="button" className={styles.btnOutlineGold}>
              Історія транзакцій
            </button>
          </div>

          {/* Balance row - right column */}
          <div className={styles.balanceRow}>
            <div className={styles.balanceLine1}>
              <div className={styles.balanceMeta}>
                <span className={styles.mutedGold}>Комісія:</span>
                <span className={styles.cyan}>15%</span>
              </div>
            </div>
            <div className={styles.balanceLine2}>
              <div className={styles.balanceMeta}>
                <span className={styles.mutedGold}>Баланс:</span>
                <span className={styles.green}>15950</span>
              </div>
              <div className={styles.balanceActions}>
                <button type="button" className={styles.btnGreen}>
                  Поповнити баланс
                </button>
                <button type="button" className={styles.btnRed}>
                  Вивести кошти
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom block: forms (left) + settings (right) */}
        <div className={styles.bottomGrid}>
          {/* Left forms */}
          <section className={styles.leftBottom}>
            <div className={styles.formBlock}>
              <h3 className={styles.blockTitle}>Змінити email</h3>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Новий email :</span>
                <span className={styles.fieldBox}>
                  <input
                    className={styles.input}
                    type="email"
                    placeholder="name@gmail.com"
                    autoComplete="email"
                  />
                </span>
              </label>

              <button type="button" className={styles.btnSave}>
                <img src={saveSvg} alt="" className={styles.btnSaveIcon} aria-hidden="true" />
                Зберегти
              </button>
            </div>

            <div className={styles.formBlock}>
              <h3 className={styles.blockTitle}>Змінити пароль</h3>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Старий пароль</span>
                <span className={styles.fieldBox}>
                  <input
                    className={styles.input}
                    type={showOldPass ? "text" : "password"}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowOldPass(!showOldPass)}
                    aria-label={showOldPass ? "Сховати пароль" : "Показати пароль"}
                  >
                    <img
                      src={showOldPass ? includedView : turnedOffView}
                      alt=""
                      className={styles.eyeIcon}
                      aria-hidden="true"
                    />
                  </button>
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Новий пароль</span>
                <span className={styles.fieldBox}>
                  <input
                    className={styles.input}
                    type={showNewPass ? "text" : "password"}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowNewPass(!showNewPass)}
                    aria-label={showNewPass ? "Сховати пароль" : "Показати пароль"}
                  >
                    <img
                      src={showNewPass ? includedView : turnedOffView}
                      alt=""
                      className={styles.eyeIcon}
                      aria-hidden="true"
                    />
                  </button>
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Підтвердити пароль</span>
                <span className={styles.fieldBox}>
                  <input
                    className={styles.input}
                    type={showConfirmPass ? "text" : "password"}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    aria-label={showConfirmPass ? "Сховати пароль" : "Показати пароль"}
                  >
                    <img
                      src={showConfirmPass ? includedView : turnedOffView}
                      alt=""
                      className={styles.eyeIcon}
                      aria-hidden="true"
                    />
                  </button>
                </span>
              </label>

              <button type="button" className={styles.btnGreenOutline}>
                <img src={saveSvg} alt="" className={styles.btnSaveIcon} aria-hidden="true" />
                Зберегти
              </button>
            </div>
          </section>

          {/* Right settings */}
          <section className={styles.rightBottom}>
            <div className={styles.settingsBlock}>
              <h3 className={styles.blockTitleCenter}>Налаштування акаунту</h3>

              <label className={styles.check}>
                <input type="checkbox" />
                <span>Сповіщення</span>
              </label>

              <label className={styles.check}>
                <input type="checkbox" />
                <span>Прибрати 18+</span>
              </label>

              <label className={styles.check}>
                <input type="checkbox" />
                <span>Отримувати приватні повідомлення</span>
              </label>

              <label className={styles.checkNote}>
                <input type="checkbox" defaultChecked />
                <span>
                  Я підтверджую, що мені виповнилося 18 років, і я можу переглядати
                  контент, призначений для дорослих.
                </span>
              </label>
            </div>

            <div className={styles.settingsBlock}>
              <h3 className={styles.blockTitleCenter}>Налаштування сповіщень</h3>

              <label className={styles.check}>
                <input type="checkbox" />
                <span>Коментарі у ваших постах та відповіді на ваші коментарі</span>
              </label>

              <label className={styles.check}>
                <input type="checkbox" />
                <span>Зміна статусу перекладу</span>
              </label>

              <label className={styles.check}>
                <input type="checkbox" />
                <span>Зняття розділу з передплати</span>
              </label>

              <label className={styles.check}>
                <input type="checkbox" />
                <span>Коментарі до розділу</span>
              </label>
            </div>

            {/* Decorative crystal */}
            <div className={styles.crystal} aria-hidden="true">
              <img src={crystalProfile} alt="" className={styles.crystalImg} />
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
