import { Container } from "../../shared/Container";
import { Breadcrumb } from "../../navigation/Breadcrumb";
import { PageTitle } from "../../navigation/PageTitle";
import styles from "./HelpPages.module.css";

export default function ContactsPage() {
  return (
    <section className={styles.page}>
      <Container>
        <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Контакти" }]} />
        <div className={styles.content}>
          <PageTitle>Контакти</PageTitle>

          <div className={styles.gridTwo}>
            <div className={styles.stack}>
              <article className={styles.card}>
                <h2 className={styles.cardTitle}>Служба підтримки</h2>
                <p className={styles.text}>Email: support@fanvers.com</p>
                <p className={styles.text}>Телефон: +380 44 123 45 67</p>
                <p className={styles.text}>Графік роботи: Пн-Пт 9:00-18:00</p>
              </article>

              <article className={styles.cardSoft}>
                <h2 className={styles.cardTitle}>Технічна підтримка</h2>
                <p className={styles.text}>Email: tech@fanvers.com</p>
                <p className={styles.text}>Для технічних питань та багів</p>
              </article>
            </div>

            <div className={styles.stack}>
              <article className={styles.cardSoft}>
                <h2 className={styles.cardTitle}>Юридичні питання</h2>
                <p className={styles.text}>Email: legal@fanvers.com</p>
                <p className={styles.text}>Для правових питань та скарг</p>
              </article>

              <article className={styles.card}>
                <h2 className={styles.cardTitle}>Співпраця</h2>
                <p className={styles.text}>Email: partnership@fanvers.com</p>
                <p className={styles.text}>Для бізнес-партнерів та рекламодавців</p>
              </article>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
