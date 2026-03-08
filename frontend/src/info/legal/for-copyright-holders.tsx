import { Container } from "../../shared/Container";
import { Breadcrumb } from "../../navigation/Breadcrumb";
import styles from "./LegalPages.module.css";

export default function ForCopyrightHoldersPage() {
  return (
    <section className={styles.page}>
      <Container>
        <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Для правовласників" }]} />
        <div className={styles.content}>
          <h1 className={styles.title}>Для правовласників</h1>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Загальні положення</h2>
            <p className={styles.text}>
              Проект fan-vers.com (далі — «Сайт») є платформою для розміщення користувачами
              власних творів та перекладів. Адміністрація Сайту поважає права інтелектуальної
              власності і вживає всіх можливих заходів для їх захисту відповідно до законодавства
              України та міжнародних угод.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Законодавча база</h2>
            <p className={styles.text}>Захист авторських прав здійснюється згідно з:</p>
            <ul className={styles.list}>
              <li>Цивільним кодексом України (книга четверта «Право інтелектуальної власності»);</li>
              <li>Законом України «Про авторське право і суміжні права»;</li>
              <li>Законом України «Про електронну комерцію»;</li>
              <li>іншими нормативно-правовими актами України;</li>
              <li>
                міжнародними договорами, згоду на обов’язковість яких надано Верховною Радою
                України (зокрема, Бернська конвенція про охорону літературних і художніх творів,
                Всесвітня конвенція про авторське право).
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>3. Повідомлення про порушення авторських прав</h2>
            <p className={styles.text}>
              Якщо Ви вважаєте, що на Сайті порушено Ваші авторські права, будь ласка, надішліть
              письмове повідомлення (електронною поштою) на адресу:{" "}
              <a className={styles.link} href="mailto:copyright@fan-vers.com">
                copyright@fan-vers.com
              </a>
              .
            </p>
            <p className={styles.text}>У повідомленні необхідно вказати:</p>
            <ul className={styles.list}>
              <li>Ваші П.І.Б. та контактні дані (електронна пошта, поштова адреса, телефон);</li>
              <li>опис твору, права на який порушено, та посилання (URL) на відповідну сторінку Сайту;</li>
              <li>вказівку, який саме матеріал порушує Ваші права та яку дію потрібно вчинити (видалення/обмеження доступу);</li>
              <li>підтвердження, що Ви є правовласником або дієте від імені правовласника;</li>
              <li>заяву про достовірність наданої інформації та усвідомлення відповідальності за подання неправдивих відомостей.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Розгляд повідомлення</h2>
            <p className={styles.text}>Після отримання повідомлення Адміністрація:</p>
            <ul className={styles.list}>
              <li>перевіряє його наявність та достатність даних;</li>
              <li>у разі підтвердження — видаляє або обмежує доступ до спірного матеріалу протягом 7 робочих днів;</li>
              <li>може звернутися до автора контенту для пояснень.</li>
            </ul>
            <p className={styles.text}>
              Якщо повідомлення не містить усіх необхідних даних, ми маємо право запросити уточнення.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>5. Зустрічні пояснення</h2>
            <p className={styles.text}>
              Користувач, контент якого було обмежено чи видалено, має право подати зустрічне
              пояснення, підтвердивши наявність у нього прав чи законних підстав на використання
              твору. Адміністрація розгляне такі пояснення та у разі підтвердження прав може
              відновити доступ до матеріалу.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>6. Повторні порушення</h2>
            <p className={styles.text}>
              У разі неодноразових або умисних порушень авторських прав Користувачем його обліковий
              запис може бути заблоковано, а доступ до Сайту — обмежено.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7. Відповідальність</h2>
            <p className={styles.text}>
              Подання неправдивої інформації у повідомленні або зустрічному поясненні може тягнути
              за собою відповідальність, передбачену чинним законодавством України.
            </p>
          </section>
        </div>
      </Container>
    </section>
  );
}
