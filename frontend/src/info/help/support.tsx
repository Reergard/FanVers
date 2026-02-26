import { Link } from "react-router-dom";
import { Container } from "../../shared/Container";
import styles from "./HelpPages.module.css";

export default function SupportPage() {
  return (
    <section className={styles.page}>
      <Container>
        <div className={styles.content}>
          <h1 className={styles.title}>Написати у підтримку</h1>

          <article className={styles.card}>
            <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
              <div className={styles.field}>
                <label htmlFor="subject" className={styles.label}>
                  Тема звернення
                </label>
                <select id="subject" className={styles.control}>
                  <option value="">Виберіть тему</option>
                  <option value="technical">Технічна проблема</option>
                  <option value="payment">Питання по платежам</option>
                  <option value="content">Питання по контенту</option>
                  <option value="account">Проблеми з акаунтом</option>
                  <option value="other">Інше</option>
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="email" className={styles.label}>
                  Ваш email
                </label>
                <input type="email" id="email" className={styles.control} placeholder="example@email.com" />
              </div>

              <div className={styles.field}>
                <label htmlFor="message" className={styles.label}>
                  Повідомлення
                </label>
                <textarea
                  id="message"
                  rows={6}
                  className={styles.control}
                  placeholder="Опишіть вашу проблему детально..."
                />
              </div>

              <button type="submit" className={styles.buttonPrimary}>
                Надіслати звернення
              </button>
            </form>
          </article>

          <div className={`${styles.cardSoft} ${styles.quickHelp}`}>
            <h2 className={styles.quickHelpTitle}>Швидка допомога</h2>
            <p className={styles.text}>
              Перед зверненням перевірте розділ FAQ — можливо, там вже є відповідь на ваше питання.
              Перейти до довідки можна тут:{" "}
              <Link to="/balance-help" className={styles.link}>
                Не поповнився баланс?
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
