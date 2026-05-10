import { Link } from "react-router-dom";
import { Container } from "../../shared/Container";
import { Breadcrumb } from "../../navigation/Breadcrumb";
import { PageTitle } from "../../navigation/PageTitle";
import { LEGAL_SITE } from "../legal/legalSite";
import styles from "./HelpPages.module.css";

/**
 * Сторінка для користувачів, у яких після оплати не відобразилося поповнення балансу.
 * Посилання з футера: «Не поповнився баланс?» (окремо від загальної сторінки «Оплата» /payment).
 */
export default function BalanceNotCreditedPage() {
  const { SUPPORT_EMAIL } = LEGAL_SITE;

  return (
    <section className={styles.page}>
      <Container>
        <Breadcrumb
          items={[
            { label: "Головна", to: "/" },
            { label: "Не поповнився баланс?" },
          ]}
        />
        <div className={styles.content}>
          <PageTitle>Не поповнився баланс?</PageTitle>

          <div className={styles.stack}>
            <p className={styles.text}>
              Якщо оплату вже списано з картки, а <strong>FanCoins</strong> на балансі не з’явилися — це не завжди означає
              помилку: інколи зарахування приходить із невеликою затримкою через банк або платіжного провайдера. Якщо
              протягом розумного часу сума так і не відобразилась, ми допоможемо розібратися.
            </p>

            <article className={styles.cardSoft}>
              <h2 className={styles.cardTitle}>Що варто мати під рукою</h2>
              <p className={styles.text}>
                Щоб підтримка швидше знайшла платіж у системі, підготуйте максимум відомостей (чим повніше форма на
                сторінці підтримки — тим швидше перевірка):
              </p>
              <ul className={styles.list}>
                <li>
                  <strong>Логін або email</strong> облікового запису, на який очікується зарахування;
                </li>
                <li>
                  <strong>Сума оплати</strong> та <strong>дата й час</strong> (за можливості — з виписки або СМС банку);
                </li>
                <li>
                  короткий опис: <strong>що саме оплачували</strong> (наприклад, поповнення балансу через Stripe
                  Checkout);
                </li>
                <li>
                  якщо після оплати вас повертало на сайт з адресою, де в параметрах є{" "}
                  <code className={styles.text}>session_id</code> — скопіюйте повне посилання або лише цей ідентифікатор;
                </li>
                <li>
                  за наявності — <strong>скріншот</strong> підтвердження оплати або фрагмент виписки (без повного номера
                  картки та CVC).
                </li>
              </ul>
            </article>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Наступний крок</h2>
              <p className={styles.text}>
                Надішліть звернення через офіційну форму підтримки. У формі заповніть <strong>усі обов’язкові поля</strong>{" "}
                і в полі з описом проблеми вкажіть дані зі списку вище — це пришвидшить відповідь.
              </p>
              <p className={styles.text}>
                <Link to="/support" className={styles.link}>
                  Перейти до форми підтримки
                </Link>
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Інші питання щодо оплати</h2>
              <p className={styles.text}>
                Загальну інформацію про ціни, coins і порядок оплати дивіться на сторінці{" "}
                <Link to="/payment" className={styles.link}>
                  Ціни та опис продукту
                </Link>
                . Загальні контакти — на сторінці{" "}
                <Link to="/contacts" className={styles.link}>
                  Контакти
                </Link>{" "}
                (<a className={styles.link} href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
                ).
              </p>
            </section>
          </div>
        </div>
      </Container>
    </section>
  );
}
