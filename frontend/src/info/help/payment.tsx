import { Container } from "../../shared/Container";
import { Breadcrumb } from "../../navigation/Breadcrumb";
import { PageTitle } from "../../navigation/PageTitle";
import { LEGAL_SITE } from "../legal/legalSite";
import styles from "./HelpPages.module.css";

export default function PaymentPage() {
  const { EFFECTIVE_DATE, PLATFORM_NAME, SUPPORT_EMAIL } = LEGAL_SITE;
  return (
    <section className={styles.page}>
      <Container>
        <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Ціни та опис продукту" }]} />
        <div className={styles.content}>
          <PageTitle>Ціни та опис продукту</PageTitle>

          <div className={styles.stack}>
            <p className={styles.text}>
              <strong>Дата набрання чинності:</strong> {EFFECTIVE_DATE}
            </p>
            <p className={styles.text}>
              Ця сторінка пояснює, що саме купує користувач на платформі <strong>{PLATFORM_NAME}</strong>, як
              формується ціна та як працюють внутрішні одиниці обліку.
            </p>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>1. Що продається на платформі</h2>
              <p className={styles.text}>На платформі можуть пропонуватися:</p>
              <ul className={styles.list}>
                <li>поповнення внутрішнього балансу;</li>
                <li>доступ до окремих глав, книг, перекладів або іншого цифрового контенту;</li>
                <li>інші цифрові функції або цифрові права використання в межах Сервісу.</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>2. Coins</h2>
              <p className={styles.text}>
                <strong>Coins</strong> — це внутрішня облікова одиниця платформи.
              </p>
              <p className={styles.text}>Coins:</p>
              <ul className={styles.list}>
                <li>використовуються лише всередині Сервісу;</li>
                <li>не є грошима, електронними грошима, депозитом чи банківським продуктом;</li>
                <li>не є інвестиційним активом;</li>
                <li>не підлягають виведенню звичайними користувачами;</li>
                <li>не мають самостійного грошового обігу поза платформою.</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>3. Що отримує користувач після оплати</h2>
              <p className={styles.text}>Після успішної оплати користувач отримує:</p>
              <ul className={styles.list}>
                <li>зарахування відповідної кількості внутрішніх одиниць на свій баланс; та/або</li>
                <li>
                  право доступу до конкретного цифрового контенту або функції, якщо це прямо вказано під час
                  оплати.
                </li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>4. Як формується ціна</h2>
              <p className={styles.text}>Ціна може визначатися:</p>
              <ul className={styles.list}>
                <li>як фіксована сума за пакет coins;</li>
                <li>як фіксована ціна за конкретну главу, книгу чи інший цифровий об’єкт;</li>
                <li>за правилами, вказаними в інтерфейсі на момент покупки.</li>
              </ul>
              <p className={styles.text}>До списання може застосовуватися:</p>
              <ul className={styles.list}>
                <li>основна ціна продукту;</li>
                <li>податки, якщо вони підлягають застосуванню;</li>
                <li>валютна конверсія або банківські збори, якщо вони виникають на стороні платіжного провайдера, банку чи карткової мережі.</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>5. Валюта</h2>
              <p className={styles.text}>
                Ціна може відображатися в різних валютах залежно від країни, платіжного методу, локалізації або
                налаштувань платіжного провайдера. Остаточна сума до списання відображається перед підтвердженням
                платежу.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>6. Важливе застереження</h2>
              <p className={styles.text}>
                Поповнення балансу або купівля coins не означає відкриття банківського чи платіжного рахунку. Це
                придбання цифрового функціоналу / внутрішнього права використання в межах Сервісу.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>7. Контакти</h2>
              <p className={styles.text}>Якщо у вас є питання щодо ціни або продукту, звертайтеся:</p>
              <p className={styles.text}>
                <strong>
                  <a className={styles.link} href={`mailto:${SUPPORT_EMAIL}`}>
                    {SUPPORT_EMAIL}
                  </a>
                </strong>
              </p>
            </section>
          </div>
        </div>
      </Container>
    </section>
  );
}
