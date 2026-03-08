import { Container } from "../../shared/Container";
import { Breadcrumb } from "../../navigation/Breadcrumb";
import styles from "./HelpPages.module.css";

export default function PaymentPage() {
  return (
    <section className={styles.page}>
      <Container>
        <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Оплата" }]} />
        <div className={styles.content}>
          <h1 className={styles.title}>Оплата</h1>

          <div className={styles.stack}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Способи оплати</h2>
              <div className={styles.gridTwo}>
                <article className={styles.card}>
                  <h3 className={styles.cardTitle}>Банківські картки</h3>
                  <ul className={styles.list}>
                    <li>Visa</li>
                    <li>MasterCard</li>
                    <li>Міжнародні та українські картки</li>
                  </ul>
                </article>

                <article className={styles.cardSoft}>
                  <h3 className={styles.cardTitle}>Електронні гаманці</h3>
                  <ul className={styles.list}>
                    <li>PayPal</li>
                    <li>Stripe</li>
                    <li>Локальні платіжні системи</li>
                  </ul>
                </article>
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Реквізити для оплати</h2>
              <article className={styles.cardSoft}>
                <div className={styles.stack}>
                  <p className={styles.text}><strong>Отримувач:</strong> ТОВ "ФанВерс"</p>
                  <p className={styles.text}><strong>IBAN:</strong> UA123456789012345678901234567</p>
                  <p className={styles.text}><strong>Банк:</strong> ПриватБанк</p>
                  <p className={styles.text}><strong>Призначення:</strong> Оплата послуг платформи FanVers</p>
                </div>
              </article>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Безпека платежів</h2>
              <article className={styles.card}>
                <p className={styles.text}>
                  Всі платежі захищені сучасними протоколами шифрування SSL/TLS.
                  Ми не зберігаємо дані ваших банківських карток.
                </p>
                <div className={styles.badgeRow}>
                  <span className={styles.badge}>Безпечно</span>
                  <span className={styles.badge}>Шифровано</span>
                  <span className={styles.badge}>Захищено</span>
                </div>
              </article>
            </section>
          </div>
        </div>
      </Container>
    </section>
  );
}
