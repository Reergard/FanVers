import { Container } from "../../shared/Container";
import { Breadcrumb } from "../../navigation/Breadcrumb";
import { PageTitle } from "../../navigation/PageTitle";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import styles from "./AboutPages.module.css";

export default function BehindTheScenesPage() {
  return (
    <section className={styles.page}>
      <Container>
        <Breadcrumb
          items={[
            { label: "Головна", to: "/" },
            { label: "За лаштунками" },
          ]}
        />
        <div className={styles.content}>
          <div className={styles.hero}>
            <span className={styles.heroEmoji} aria-hidden>
              🚀
            </span>
            <PageTitle>Ми офіційно у грі (і на зв'язку)</PageTitle>
            <p className={styles.heroSubtitle}>
              Про запуск, великі плани та маленьких «багів-шпигунів».
            </p>
          </div>

          <div className={styles.introCard}>
            <h2 className={styles.sectionTitle}>Дорогі автори та читачі!</h2>
            <p className={styles.text}>
              FanVers нарешті відкрив свої двері для всіх шанувальників історій.
              Ми неймовірно щасливі бачити ваші перші опубліковані твори, лайки
              та коментарі. Дякуємо, що ви з нами з перших днів!
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Що готово і що попереду</h2>
            <p className={styles.text}>
              Платформа вже повністю готова до «бойового» режиму: основний
              функціонал працює, сервери готові до напливу натхнення, а тексти
              чекають на своїх читачів. Проте, як то кажуть, навіть у
              наймасштабніших історіях іноді трапляються друкарські помилки.
            </p>
            <p className={styles.text}>
              Зараз FanVers перебуває на етапі{" "}
              <span className={styles.highlight}>пре-лончу (Pre-launch)</span>.
              Наші власні ідеї втілені приблизно на{" "}
              <span className={styles.strong}>70%</span>, попереду ще безліч
              крутих оновлень. Оскільки сайт об'ємний і функціоналу дійсно
              багато, десь у темних куточках коду можуть ховатися дрібні
              шорсткості або баги, які ми під час тестів просто не помітили.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Не лякайтеся багів!</h2>
            <p className={styles.text}>
              Навіть у гігантів на кшталт Google чи Instagram бувають технічні
              збої. Якщо ви помітили, що якась кнопка «примхує», або щось
              відображається не так, як мало б — не панікуйте і не
              засмучуйтеся.{" "}
              <span className={styles.strong}>Ми все виправимо!</span>
            </p>
          </div>

          <div className={styles.ctaCard}>
            <h2 className={styles.ctaTitle}>
              Як допомогти зробити FanVers ідеальним?
            </h2>
            <p className={styles.text}>
              Замість того, щоб шукати магію поза сайтом, пишіть про всі
              помічені баги, а також про ваші круті ідеї та пропозиції прямо
              нам!
            </p>
            <p className={styles.text}>
              Ми відкриті до конструктивної критики та хочемо почути погляд
              кожного автора й читача. Разом ми зробимо FanVers максимально
              затишним, зручним та крутим місцем для творчості!
            </p>
            <div className={styles.ctaActions}>
              <ActionButton variant="outline" size="sm" to="/support">
                Написати в підтримку
              </ActionButton>
            </div>
          </div>

          <div className={styles.signature}>
            <span>З повагою та любов'ю,</span>
            <span className={styles.signatureName}>
              Команда FanVers{" "}
              <span className={styles.signatureHeart} aria-hidden>
                💙
              </span>
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
