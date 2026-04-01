import { Link } from "react-router-dom";
import { Container } from "../../shared/Container";
import { Breadcrumb } from "../../navigation/Breadcrumb";
import { PageTitle } from "../../navigation/PageTitle";
import { LEGAL_SITE } from "./legalSite";
import styles from "./LegalPages.module.css";

export default function ForCopyrightHoldersPage() {
  const { SUPPORT_EMAIL, WEBSITE_DOMAIN } = LEGAL_SITE;

  return (
    <section className={styles.page}>
      <Container>
        <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Для правовласників" }]} />
        <div className={styles.content}>
          <PageTitle>Для правовласників</PageTitle>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Загальні положення</h2>
            <p className={styles.text}>
              Платформа <strong>{WEBSITE_DOMAIN}</strong> є сервісом, який дозволяє користувачам
              розміщувати власний контент, переклади та інші матеріали. Оператор поважає права
              інтелектуальної власності та розглядає обґрунтовані повідомлення про можливе
              порушення таких прав.
            </p>
            <p className={styles.text}>
              Ця сторінка описує порядок подання повідомлень від правовласників або їхніх
              уповноважених представників щодо контенту, який, на їхню думку, порушує авторські,
              суміжні або інші права інтелектуальної власності.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Як подати повідомлення</h2>
            <p className={styles.text}>
              Якщо ви вважаєте, що певний контент у Сервісі порушує ваші права, надішліть
              повідомлення на адресу:
            </p>
            <p className={styles.text}>
              <a className={styles.link} href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </p>
            <p className={styles.text}>
              У темі листа рекомендуємо вказати: <strong>IP / Copyright Complaint</strong>.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>3. Що потрібно вказати у повідомленні</h2>
            <ul className={styles.list}>
              <li>ваше ім’я / назву правовласника та контактні дані;</li>
              <li>опис об’єкта права, який, на вашу думку, порушується;</li>
              <li>посилання (URL) на спірний матеріал у Сервісі;</li>
              <li>опис того, у чому саме полягає порушення;</li>
              <li>вказівку, чи дієте ви від власного імені або від імені правовласника;</li>
              <li>за наявності — документи, посилання або інші матеріали, що підтверджують ваші права або повноваження;</li>
              <li>заяву про достовірність наданої інформації та про те, що ви дієте добросовісно.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Розгляд повідомлення</h2>
            <p className={styles.text}>Після отримання достатньо обґрунтованого повідомлення Оператор може:</p>
            <ul className={styles.list}>
              <li>запросити додаткову інформацію або підтвердження;</li>
              <li>тимчасово обмежити доступ до спірного матеріалу;</li>
              <li>видалити або приховати матеріал;</li>
              <li>звернутися до користувача, який розмістив контент, за поясненнями чи документами;</li>
              <li>вжити інших розумно необхідних заходів для мінімізації ризику порушення прав.</li>
            </ul>
            <p className={styles.text}>
              Якщо повідомлення є явно неповним, необґрунтованим або не дозволяє ідентифікувати
              спірний матеріал, Оператор може залишити його без задоволення до отримання уточнень.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>5. Пояснення користувача</h2>
            <p className={styles.text}>
              Користувач, контент якого було обмежено або видалено, може надати пояснення,
              підтвердження прав або інші законні підстави використання матеріалу. Після розгляду
              таких пояснень Оператор може залишити обмеження в силі, змінити їх або відновити
              доступ до матеріалу.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>6. Повторні порушення</h2>
            <p className={styles.text}>
              У разі повторних, умисних або грубих порушень прав інтелектуальної власності Оператор
              може застосувати заходи, передбачені{" "}
              <Link className={styles.link} to="/user-agreement">
                Умовами використання
              </Link>
              , включно з видаленням контенту, демонетизацією, обмеженням функцій або блокуванням
              акаунта.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7. Добросовісність звернень</h2>
            <p className={styles.text}>
              Будь ласка, подавайте звернення добросовісно. Умисне подання неправдивих, оманливих
              або безпідставних скарг може порушувати права інших осіб і тягнути наслідки,
              передбачені застосовним законодавством.
            </p>
          </section>
        </div>
      </Container>
    </section>
  );
}
