import { Container } from "../../shared/Container";
import { Breadcrumb } from "../../navigation/Breadcrumb";
import { PageTitle } from "../../navigation/PageTitle";
import { LEGAL_SITE } from "./legalSite";
import styles from "./LegalPages.module.css";

export default function RefundPolicyPage() {
  const { EFFECTIVE_DATE, PLATFORM_NAME, SUPPORT_EMAIL } = LEGAL_SITE;
  return (
    <section className={styles.page}>
      <Container>
        <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Політика повернень і скасувань" }]} />
        <div className={styles.content}>
          <PageTitle>Політика повернень і скасувань</PageTitle>

          <p className={styles.text}>
            <strong>Дата набрання чинності:</strong> {EFFECTIVE_DATE}
            <br />
            <strong>Останнє оновлення:</strong> {EFFECTIVE_DATE}
          </p>

          <p className={styles.text}>
            Ця Політика повернень і скасувань застосовується до платежів, поповнень балансу, цифрового контенту та
            інших цифрових продуктів, що надаються через <strong>{PLATFORM_NAME}</strong>.
          </p>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Загальний принцип</h2>
            <p className={styles.text}>
              Оскільки Сервіс надає <strong>цифровий контент</strong> та/або <strong>цифрові послуги</strong>,
              повернення коштів не є автоматичними для всіх випадків. Кожен запит розглядається відповідно до
              застосовного законодавства, правил платіжного провайдера, фактичних обставин та цієї Політики.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Коли повернення можливе</h2>
            <p className={styles.text}>Ми можемо надати повне або часткове повернення, зокрема, якщо:</p>
            <ul className={styles.list}>
              <li>
                відбулося <strong>подвійне списання</strong> або інша очевидна технічна помилка;
              </li>
              <li>
                з вашого рахунку було списано кошти, але coins або придбаний доступ фактично не були надані, і ми не
                змогли усунути проблему в розумний строк;
              </li>
              <li>транзакція була проведена помилково з нашої вини або через підтверджений системний збій;</li>
              <li>цього прямо вимагає застосовне законодавство;</li>
              <li>
                цифровий контент / цифрова послуга мають дефект, який ми не усунули в розумний строк або не можемо
                усунути;
              </li>
              <li>інший винятковий випадок, який ми визнаємо обґрунтованим після перевірки.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>3. Коли повернення, як правило, не надається</h2>
            <p className={styles.text}>
              Повернення, як правило, <strong>не надається</strong>, якщо:
            </p>
            <ul className={styles.list}>
              <li>coins уже були витрачені повністю або частково;</li>
              <li>доступ до цифрового контенту вже було надано;</li>
              <li>користувач почав споживання цифрового контенту / цифрової послуги;</li>
              <li>
                користувач надав згоду на негайне надання цифрового контенту / цифрової послуги та підтвердив втрату
                права на відмову, якщо це вимагається законом;
              </li>
              <li>запит пов’язаний лише з суб’єктивним невдоволенням, але послуга була надана належним чином;</li>
              <li>
                є ознаки шахрайства, зловживання, порушення правил, маніпуляцій або спроби отримати безпідставне
                повернення.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Право на відмову для цифрового контенту</h2>
            <p className={styles.text}>
              Якщо ви є споживачем у розумінні застосовного законодавства, ви можете мати право на відмову від
              дистанційного договору протягом визначеного законом строку. Однак щодо цифрового контенту, який
              надається без матеріального носія, це право може бути втрачено з моменту надання доступу, якщо до цього:
            </p>
            <ul className={styles.list}>
              <li>ви прямо погодилися на негайне надання такого контенту / послуги; і</li>
              <li>
                підтвердили, що у зв’язку з цим втрачаєте право на відмову, якщо таке підтвердження вимагається
                законом.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>5. Строк подання запиту</h2>
            <p className={styles.text}>
              Щоб прискорити розгляд, просимо подавати запит на повернення{" "}
              <strong>без невиправданої затримки</strong>, щойно ви виявили проблему. Якщо інше не вимагається
              законом, ми рекомендуємо звертатися не пізніше ніж протягом <strong>14 днів</strong> з моменту
              транзакції або виявлення проблеми.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>6. Як подати запит</h2>
            <p className={styles.text}>
              Надішліть звернення на:{" "}
              <strong>
                <a className={styles.link} href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </strong>
            </p>
            <p className={styles.text}>У запиті вкажіть:</p>
            <ul className={styles.list}>
              <li>email акаунта;</li>
              <li>дату та суму платежу;</li>
              <li>ідентифікатор транзакції, якщо він є;</li>
              <li>опис проблеми;</li>
              <li>скріншоти або інші докази, якщо вони є.</li>
            </ul>
            <p className={styles.text}>Ми можемо попросити додаткову інформацію для перевірки.</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7. Як ми розглядаємо запит</h2>
            <p className={styles.text}>Ми перевіряємо:</p>
            <ul className={styles.list}>
              <li>факт і статус транзакції;</li>
              <li>чи були надані coins, доступ або інша цифрова вигода;</li>
              <li>чи був контент уже використаний;</li>
              <li>чи є підстави за законом або за цією Політикою;</li>
              <li>чи є ризик шахрайства, abuse, чарджбеку або іншого порушення.</li>
            </ul>
            <p className={styles.text}>
              Ми можемо відмовити в поверненні, якщо запит є необґрунтованим або суперечить закону, комплаєнсу,
              правилам платіжного провайдера чи безпековим вимогам.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>8. Спосіб повернення</h2>
            <p className={styles.text}>
              Якщо повернення схвалене, воно, як правило, здійснюється тим самим способом оплати, яким була
              проведена первинна транзакція, якщо інше не вимагається законом або не є технічно необхідним.
            </p>
            <p className={styles.text}>У деяких випадках, якщо це дозволено законом і правилами провайдера, ми можемо запропонувати:</p>
            <ul className={styles.list}>
              <li>повторне надання контенту або доступу;</li>
              <li>внутрішнє коригування балансу;</li>
              <li>часткове повернення.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>9. Строки повернення</h2>
            <p className={styles.text}>
              Після схвалення повернення ми ініціюємо його в розумний строк. Фактичний строк зарахування коштів
              залежить від банку, карткової мережі, Stripe або іншого платіжного провайдера.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>10. Чарджбеки</h2>
            <p className={styles.text}>Подача чарджбеку без попереднього звернення до підтримки може призвести до:</p>
            <ul className={styles.list}>
              <li>тимчасового обмеження акаунта;</li>
              <li>призупинення доступу до контенту;</li>
              <li>замороження внутрішнього балансу або виплат;</li>
              <li>додаткової перевірки на предмет fraud / abuse.</li>
            </ul>
            <p className={styles.text}>Ми рекомендуємо спочатку звернутися до нас напряму.</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>11. Спеціальні правила для авторів, перекладачів та отримувачів виплат</h2>
            <p className={styles.text}>
              Якщо ви отримуєте виплати через платформу, ми можемо утримувати, зменшувати або сторнувати суми,
              пов’язані з:
            </p>
            <ul className={styles.list}>
              <li>поверненнями користувачам;</li>
              <li>чарджбеками;</li>
              <li>штрафами платіжних систем;</li>
              <li>fraud / abuse;</li>
              <li>порушеннями правил платформи;</li>
              <li>юридичними або комплаєнс-вимогами.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>12. Контакти</h2>
            <p className={styles.text}>З питань повернень звертайтеся:</p>
            <p className={styles.text}>
              <strong>
                <a className={styles.link} href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </strong>
            </p>
          </section>
        </div>
      </Container>
    </section>
  );
}
