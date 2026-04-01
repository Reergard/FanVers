import { Container } from "../../shared/Container";
import { Breadcrumb } from "../../navigation/Breadcrumb";
import { PageTitle } from "../../navigation/PageTitle";
import styles from "./LegalPages.module.css";

export default function TranslatorAgreementPage() {
  return (
    <section className={styles.page}>
      <Container>
        <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Договір перекладача" }]} />
        <div className={styles.content}>
          <PageTitle>ПРИКЛАД ДОГОВОРУ МІЖ АВТОРОМ І ПЕРЕКЛАДАЧЕМ</PageTitle>
          <p className={styles.subtitle}>шаблон для самостійного використання сторонами на власну відповідальність</p>

          <div className={styles.introCard}>
            <p className={styles.text}>
              <strong>Цей документ є лише прикладом договору.</strong> Платформа Fan-Vers не є стороною
              договору між Автором та Перекладачем та не несе відповідальності за такі правовідносини.
            </p>
            <p className={styles.text}>
              Оператор Платформи не перевіряє юридичну достатність цього шаблону для конкретної ситуації
              та не несе відповідальності за його використання, виконання або наслідки.
            </p>
            <p className={styles.text}>
              Автор і Перекладач самостійно оцінюють, чи підходить їм цей шаблон, за потреби
              змінюють його та несуть повну відповідальність за свої правовідносини, права на
              оригінальний твір, права на переклад, обсяг дозволів, винагороду, строки, територію,
              порядок публікації та будь-які спори між собою або з третіми особами.
            </p>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Сторони</h2>
            <p className={styles.text}>
              Автор: ______________________________________________
            </p>
            <p className={styles.text}>
              Перекладач: _________________________________________
            </p>
            <p className={styles.text}>
              Дата: ________________________________________________
            </p>
            <p className={styles.text}>
              Місце укладення: _____________________________________
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Предмет договору</h2>
            <p className={styles.text}>
              2.1. Автор надає Перекладачеві право здійснити переклад твору:
            </p>
            <p className={styles.text}>
              Назва твору: _________________________________________
            </p>
            <p className={styles.text}>
              Автор оригінального твору: ____________________________
            </p>
            <p className={styles.text}>
              Мова оригіналу: ______________________________________
            </p>
            <p className={styles.text}>
              Мова перекладу: ______________________________________
            </p>
            <p className={styles.text}>
              2.2. Сторони погоджують, що Перекладач виконує переклад на умовах цього договору, а
              Автор підтверджує наявність у себе достатніх прав або дозволів, необхідних для
              надання такого права.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>3. Права на переклад і спосіб використання</h2>
            <p className={styles.text}>
              3.1. Сторони повинні прямо погодити, кому і в якому обсязі належать або передаються
              права на переклад після його створення.
            </p>
            <p className={styles.text}>Рекомендовано окремо визначити:</p>
            <ul className={styles.list}>
              <li>чи отримує Перекладач право лише створити переклад, чи також публікувати його;</li>
              <li>чи має Автор право розміщувати переклад на сайтах, у застосунках, друкованих або інших виданнях;</li>
              <li>чи допускається монетизація перекладу;</li>
              <li>на якій території та протягом якого строку допускається використання перекладу;</li>
              <li>чи допускається редагування, адаптація або подальша переробка перекладу.</li>
            </ul>
            <p className={styles.text}>
              3.2. Сторони повинні самостійно і чітко зафіксувати ці умови письмово. За замовчуванням
              цей шаблон не встановлює остаточний розподіл майнових прав між сторонами.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Гарантії сторін</h2>
            <p className={styles.text}>Автор гарантує, що:</p>
            <ul className={styles.list}>
              <li>має достатні права або дозволи на оригінальний твір для надання його на переклад;</li>
              <li>укладення цього договору не порушує прав третіх осіб;</li>
              <li>інформація, надана Перекладачеві, є достовірною в межах, суттєвих для договору.</li>
            </ul>
            <p className={styles.text}>Перекладач гарантує, що:</p>
            <ul className={styles.list}>
              <li>виконає переклад особисто або в погоджений зі стороною спосіб;</li>
              <li>не буде свідомо порушувати права третіх осіб при створенні перекладу;</li>
              <li>надасть результат у строки та в обсязі, погоджених сторонами, якщо інше не буде узгоджено додатково.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>5. Винагорода та розрахунки</h2>
            <p className={styles.text}>
              5.1. Сторони повинні окремо погодити, чи є переклад безоплатним або оплатним.
            </p>
            <p className={styles.text}>Рекомендується прямо зазначити:</p>
            <ul className={styles.list}>
              <li>фіксовану суму, відсоток, роялті або іншу модель винагороди;</li>
              <li>строк і спосіб оплати;</li>
              <li>валюту платежу;</li>
              <li>порядок дій у разі затримки, спору або повернення коштів;</li>
              <li>чи поширюється винагорода лише на створення перекладу, чи також на подальше використання.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>6. Передача та приймання перекладу</h2>
            <p className={styles.text}>Сторонам рекомендується погодити:</p>
            <ul className={styles.list}>
              <li>у якому форматі передається переклад;</li>
              <li>куди саме він надсилається;</li>
              <li>скільки часу Автор має на перевірку;</li>
              <li>чи може Автор вимагати доопрацювання та в які строки;</li>
              <li>коли переклад вважається прийнятим.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7. Відповідальність сторін</h2>
            <p className={styles.text}>
              7.1. Автор і Перекладач самостійно відповідають один перед одним та перед третіми
              особами за порушення своїх зобов’язань, недостовірні гарантії, відсутність прав,
              порушення авторських прав або інші порушення закону.
            </p>
            <p className={styles.text}>
              7.2. Fan-Vers та Оператор Платформи не є арбітром, представником, агентом, роботодавцем
              або стороною такого договору і не несуть відповідальності за будь-які спори між
              Автором і Перекладачем.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>8. Застосовне право та спори</h2>
            <p className={styles.text}>
              Сторонам рекомендується окремо погодити, право якої держави регулює цей договір, а
              також порядок досудового врегулювання та компетентний суд або інший спосіб вирішення
              спорів.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>9. Підписи сторін</h2>
            <div className={styles.signatureGrid}>
              <div className={styles.signatureCol}>
                <p className={styles.text}><strong>АВТОР:</strong></p>
                <p className={`${styles.text} ${styles.muted}`}>__________________________</p>
                <p className={`${styles.text} ${styles.muted}`}>__________________________</p>
                <p className={`${styles.text} ${styles.muted}`}>__________________________</p>
              </div>
              <div className={styles.signatureCol}>
                <p className={styles.text}><strong>ПЕРЕКЛАДАЧ:</strong></p>
                <p className={`${styles.text} ${styles.muted}`}>__________________________</p>
                <p className={`${styles.text} ${styles.muted}`}>__________________________</p>
                <p className={`${styles.text} ${styles.muted}`}>__________________________</p>
              </div>
            </div>
          </section>
        </div>
      </Container>
    </section>
  );
}
