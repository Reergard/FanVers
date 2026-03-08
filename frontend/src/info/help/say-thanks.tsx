import { Container } from "../../shared/Container";
import { Breadcrumb } from "../../navigation/Breadcrumb";
import styles from "./HelpPages.module.css";

export default function SayThanksPage() {
  return (
    <section className={styles.page}>
      <Container>
        <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Сказати «Дякую!»" }]} />
        <div className={styles.content}>
          <h1 className={styles.title}>Сказати «Дякую!»</h1>

          <div className={styles.stack}>
            <section className={styles.section}>
              <p className={styles.lead}>
                Якщо вам сподобався наш проект і ви хочете підтримати його розвиток,
                ми будемо вдячні за будь-яку допомогу!
              </p>

              <article className={styles.card}>
                <h2 className={styles.cardTitle}>Способи підтримки</h2>
                <ul className={styles.list}>
                  <li>Донат через платіжні системи</li>
                  <li>Розповсюдження інформації про проект</li>
                  <li>Надсилання відгуків та пропозицій</li>
                  <li>Участь у тестуванні нових функцій</li>
                </ul>
              </article>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Донат</h2>
              <div className={styles.gridThree}>
                <article className={styles.cardSoft}>
                  <div className={styles.donationIcon}>☕</div>
                  <h3 className={styles.cardTitle}>Кава</h3>
                  <p className={styles.amount}>100 грн</p>
                  <button className={styles.buttonPrimary} type="button">Підтримати</button>
                </article>

                <article className={styles.cardSoft}>
                  <div className={styles.donationIcon}>🍕</div>
                  <h3 className={styles.cardTitle}>Піца</h3>
                  <p className={styles.amount}>200 грн</p>
                  <button className={styles.buttonPrimary} type="button">Підтримати</button>
                </article>

                <article className={styles.cardSoft}>
                  <div className={styles.donationIcon}>🎁</div>
                  <h3 className={styles.cardTitle}>Подарунок</h3>
                  <p className={styles.amount}>На скільки щедра ваша душа)))</p>
                  <button className={styles.buttonPrimary} type="button">Підтримати</button>
                </article>
              </div>
            </section>

            <section className={styles.section}>
              <article className={styles.cardSoft}>
                <h3 className={styles.cardTitle}>Інші способи підтримки</h3>
                <p className={styles.text}>
                  Напишіть нам про те, що вам подобається в проекті, або поділіться ідеями
                  для покращення. Ваша думка дуже важлива для нас!
                </p>
                <button className={styles.buttonSecondary} type="button">Написати відгук</button>
              </article>
            </section>
          </div>
        </div>
      </Container>
    </section>
  );
}
