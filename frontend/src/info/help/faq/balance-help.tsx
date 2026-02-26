import { Container } from "../../../shared/Container";
import styles from "../HelpPages.module.css";

export default function BalanceHelpPage() {
  return (
    <section className={styles.page}>
      <Container>
        <div className={styles.content}>
          <h1 className={styles.title}>Не поповнився баланс?</h1>

          <div className={styles.stack}>
            <article className={styles.card}>
              <h2 className={styles.cardTitle}>Перевірте статус платежу</h2>
              <p className={styles.text}>
                Якщо платіж не пройшов, перевірте статус у вашому банку або електронному
                гаманці. Іноді потрібно до 24 годин для обробки.
              </p>
            </article>

            <article className={styles.cardSoft}>
              <h2 className={styles.cardTitle}>Зверніться до підтримки</h2>
              <p className={styles.text}>
                Якщо проблема залишається, зверніться до служби підтримки.
                Надайте номер транзакції та деталі платежу.
              </p>
            </article>

            <article className={styles.card}>
              <h2 className={styles.cardTitle}>Альтернативні способи</h2>
              <p className={styles.text}>
                Спробуйте інший спосіб оплати або зверніться до банку для перевірки
                можливих обмежень.
              </p>
            </article>
          </div>
        </div>
      </Container>
    </section>
  );
}
