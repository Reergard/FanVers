import { Container } from "../../shared/Container";
import { Breadcrumb } from "../../navigation/Breadcrumb";
import { PageTitle } from "../../navigation/PageTitle";
import { LEGAL_SITE } from "../legal/legalSite";
import styles from "./HelpPages.module.css";

export default function ContactsPage() {
  const { SUPPORT_EMAIL: mail, ADDRESS_FULL } = LEGAL_SITE;
  return (
    <section className={styles.page}>
      <Container>
        <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Контакти" }]} />
        <div className={styles.content}>
          <PageTitle>Контактна інформація</PageTitle>

          <div className={styles.stack}>
            <article className={styles.cardSoft}>
              <p className={styles.text}>
                <strong>Fan-Vers</strong>
              </p>
              <p className={styles.text}>Форма діяльності: živnostník</p>
              <p className={styles.text}>Країна: Чехія</p>
              <p className={styles.text}>
                IČO: {LEGAL_SITE.ICO}
              </p>
              <p className={styles.text}>Адреса: {ADDRESS_FULL}</p>
              <p className={styles.text}>
                Email підтримки:{" "}
                <a className={styles.link} href={`mailto:${mail}`}>
                  {mail}
                </a>
              </p>
            </article>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Для користувачів</h2>
              <p className={styles.text}>З питань:</p>
              <ul className={styles.list}>
                <li>акаунта;</li>
                <li>оплат;</li>
                <li>повернень;</li>
                <li>доступу до контенту;</li>
                <li>скарг і повідомлень про порушення,</li>
              </ul>
              <p className={styles.text}>
                пишіть на:{" "}
                <a className={styles.link} href={`mailto:${mail}`}>
                  {mail}
                </a>
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Для правових та privacy-запитів</h2>
              <p className={styles.text}>
                Email:{" "}
                <a className={styles.link} href={`mailto:${mail}`}>
                  {mail}
                </a>
              </p>
            </section>
          </div>
        </div>
      </Container>
    </section>
  );
}
