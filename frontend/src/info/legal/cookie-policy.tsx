import { Container } from "../../shared/Container";
import { Breadcrumb } from "../../navigation/Breadcrumb";
import { PageTitle } from "../../navigation/PageTitle";
import { LEGAL_SITE } from "./legalSite";
import styles from "./LegalPages.module.css";

export default function CookiePolicyPage() {
  const { EFFECTIVE_DATE, PLATFORM_NAME, WEBSITE_DOMAIN, SUPPORT_EMAIL } = LEGAL_SITE;

  return (
    <section className={styles.page}>
      <Container>
        <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Політика cookies" }]} />
        <div className={styles.content}>
          <PageTitle>Політика cookies</PageTitle>

          <p className={styles.text}>
            <strong>Дата набрання чинності:</strong> {EFFECTIVE_DATE}
            <br />
            <strong>Останнє оновлення:</strong> {EFFECTIVE_DATE}
          </p>

          <p className={styles.text}>
            Ця Політика cookies пояснює, як <strong>{PLATFORM_NAME}</strong> використовує cookies та
            подібні технології на сайті <strong>{WEBSITE_DOMAIN}</strong>, а також як користувач може
            керувати своїми налаштуваннями.
          </p>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Що таке cookies</h2>
            <p className={styles.text}>
              Cookies — це невеликі текстові файли або подібні технології, які зберігаються у браузері
              або на пристрої користувача. Вони використовуються для забезпечення роботи Сервісу,
              безпеки, підтримки сесій та збереження налаштувань.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Як ми фактично використовуємо дані</h2>
            <p className={styles.text}>
              Частина статистичних даних (наприклад, перегляди книг, лайки, рейтинги, взаємодія з контентом)
              збирається через серверну логіку Сервісу під час виконання дій користувача.
            </p>
            <p className={styles.text}>
              Така аналітика:
            </p>
            <ul className={styles.list}>
              <li>не базується на cookies або сторонніх трекерах;</li>
              <li>використовується виключно для роботи функцій Сервісу (рейтинги, ТОПи, рекомендації);</li>
              <li>може враховувати лише дії авторизованих користувачів.</li>
            </ul>
            <p className={styles.text}>
              Дані неавторизованих користувачів можуть не використовуватися для формування таких метрик.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>3. Категорії cookies</h2>

            <h3 className={styles.subsectionTitle}>3.1. Строго необхідні cookies</h3>
            <p className={styles.text}>
              Використовуються для базової роботи сайту і не можуть бути вимкнені.
            </p>
            <ul className={styles.list}>
              <li>авторизація (JWT, сесія);</li>
              <li>безпека та anti-fraud;</li>
              <li>захист від зловживань;</li>
              <li>збереження вашого вибору cookies;</li>
              <li>робота checkout і платежів;</li>
            </ul>

            <h3 className={styles.subsectionTitle}>3.2. Функціональні cookies</h3>
            <p className={styles.text}>
              Використовуються для запам’ятовування налаштувань інтерфейсу (наприклад, мови або локальних параметрів).
            </p>

            <h3 className={styles.subsectionTitle}>3.3. Аналітика</h3>
            <p className={styles.text}>
              Сервіс не використовує класичні аналітичні cookies (наприклад Google Analytics), якщо це прямо не зазначено окремо.
            </p>
            <p className={styles.text}>
              Замість цього застосовується серверна обробка подій (див. розділ 2).
            </p>

            <h3 className={styles.subsectionTitle}>3.4. Маркетингові cookies</h3>
            <p className={styles.text}>
              Використовуються лише у разі впровадження відповідних інструментів і тільки після отримання згоди користувача.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Згода користувача</h2>
            <p className={styles.text}>
              Під час першого відвідування сайту може відображатися banner cookies, де користувач може:
            </p>
            <ul className={styles.list}>
              <li><strong>Прийняти всі</strong></li>
              <li><strong>Відхилити</strong></li>
              <li><strong>Налаштувати</strong></li>
            </ul>

            <p className={styles.text}>
              Вибір користувача може зберігатися:
            </p>
            <ul className={styles.list}>
              <li>у браузері (localStorage / cookies);</li>
              <li>у базі даних для авторизованих користувачів;</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>5. Відмова від cookies</h2>
            <p className={styles.text}>
              У разі відмови використовуються лише строго необхідні технології.
            </p>
            <p className={styles.text}>
              При цьому можуть бути обмежені:
            </p>
            <ul className={styles.list}>
              <li>персоналізація;</li>
              <li>необов’язкові інтеграції;</li>
              <li>частина UX-функцій.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>6. Stripe та платежі</h2>
            <p className={styles.text}>
              Для обробки платежів використовуються технології <strong>Stripe</strong>.
            </p>
            <p className={styles.text}>
              Вони можуть включати cookies та інші технічні механізми для:
            </p>
            <ul className={styles.list}>
              <li>обробки платежів;</li>
              <li>захисту від шахрайства;</li>
              <li>дотримання вимог безпеки;</li>
            </ul>
            <p className={styles.text}>
              Такі технології можуть вважатися необхідними при ініціації платежу користувачем.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7. Сторонні сервіси</h2>
            <p className={styles.text}>
              При використанні входу через Google або Meta можуть застосовуватися їхні власні cookies.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>8. Керування cookies</h2>
            <ul className={styles.list}>
              <li>через banner;</li>
              <li>через налаштування акаунта;</li>
              <li>через браузер;</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>9. Зміни</h2>
            <p className={styles.text}>
              Політика може оновлюватися.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>10. Контакти</h2>
            <p className={styles.text}>
              <strong>
                <a className={styles.link} href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </strong>
            </p>
          </section>
        </div>
      </Container>
    </section>
  );
}
