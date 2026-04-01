import { Link } from "react-router-dom";
import { Container } from "../../shared/Container";
import { Breadcrumb } from "../../navigation/Breadcrumb";
import { PageTitle } from "../../navigation/PageTitle";
import { LEGAL_SITE } from "./legalSite";
import styles from "./LegalPages.module.css";

export default function PrivacyPolicyPage() {
  const { EFFECTIVE_DATE, PLATFORM_NAME, WEBSITE_DOMAIN, LEGAL_NAME, ICO, ADDRESS_FULL, SUPPORT_EMAIL } =
    LEGAL_SITE;
  return (
    <section className={styles.page}>
      <Container>
        <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Політика конфіденційності" }]} />
        <div className={styles.content}>
          <PageTitle>Політика конфіденційності</PageTitle>

          <p className={styles.text}>
            <strong>Дата набрання чинності:</strong> {EFFECTIVE_DATE}
            <br />
            <strong>Останнє оновлення:</strong> {EFFECTIVE_DATE}
          </p>

          <p className={styles.text}>
            Ця Політика конфіденційності описує, як <strong>{PLATFORM_NAME}</strong> («ми», «нас», «наш Сервіс»)
            збирає, використовує, зберігає, передає та захищає персональні дані користувачів вебсайту{" "}
            <strong>{WEBSITE_DOMAIN}</strong>.
          </p>
          <p className={styles.text}>
            Володілець та оператор Сервісу:
            <br />
            <strong>{LEGAL_NAME}</strong>, živnostník, Чехія
            <br />
            IČO: {ICO}
            <br />
            Адреса: {ADDRESS_FULL}
            <br />
            Email для питань щодо приватності:{" "}
            <a className={styles.link} href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
          </p>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Хто ми і яка наша роль</h2>
            <p className={styles.text}>
              Ми є оператором онлайн-платформи, через яку користувачі можуть створювати облікові записи,
              поповнювати внутрішній баланс, купувати доступ до цифрового контенту та, якщо вони є авторами,
              перекладачами чи іншими схваленими отримувачами, отримувати виплати відповідно до правил Сервісу.
            </p>
            <p className={styles.text}>У межах обробки персональних даних ми можемо виступати:</p>
            <ul className={styles.list}>
              <li>
                <strong>контролером</strong> персональних даних — коли визначаємо цілі та засоби обробки;
              </li>
              <li>
                <strong>процесором / обробником</strong> або спільно діючою стороною — у тих частинах, де це
                випливає з архітектури платіжних, аналітичних або авторизаційних сервісів.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Які дані ми збираємо</h2>

            <h3 className={styles.subsectionTitle}>2.1. Дані, які ви надаєте нам безпосередньо</h3>
            <p className={styles.text}>Ми можемо збирати:</p>
            <ul className={styles.list}>
              <li>ім’я, псевдонім, нікнейм, ім’я профілю;</li>
              <li>адресу електронної пошти;</li>
              <li>пароль у захищеному вигляді або дані, потрібні для автентифікації;</li>
              <li>мову інтерфейсу, налаштування профілю, інформацію акаунта;</li>
              <li>контент, який ви добровільно публікуєте, завантажуєте або надсилаєте через Сервіс;</li>
              <li>звернення до підтримки, претензії, повідомлення про порушення, скарги;</li>
              <li>
                інформацію, яку ви надаєте для проходження перевірки або для отримання виплат, якщо ви автор,
                перекладач або інший отримувач виплат.
              </li>
            </ul>

            <h3 className={styles.subsectionTitle}>2.2. Дані, які ми отримуємо автоматично</h3>
            <p className={styles.text}>Ми можемо збирати:</p>
            <ul className={styles.list}>
              <li>IP-адресу;</li>
              <li>технічні дані пристрою та браузера;</li>
              <li>журнали входу, час доступу, сторінки, які ви переглядаєте;</li>
              <li>ідентифікатори сесії, cookies та подібні технології;</li>
              <li>дані про взаємодію з функціями сайту, помилки, події безпеки, anti-fraud сигнали.</li>
            </ul>

            <h3 className={styles.subsectionTitle}>2.3. Дані, які ми отримуємо від третіх сторін</h3>
            <p className={styles.text}>
              Якщо ви входите через <strong>Facebook / Meta</strong>, <strong>Google</strong> або інший сторонній
              сервіс авторизації, ми можемо отримати дані, які ви дозволили передати такому сервісу, наприклад:
            </p>
            <ul className={styles.list}>
              <li>ім’я;</li>
              <li>email;</li>
              <li>ідентифікатор облікового запису у стороннього провайдера;</li>
              <li>аватар або іншу базову інформацію профілю, якщо ви надали такий дозвіл.</li>
            </ul>

            <h3 className={styles.subsectionTitle}>2.4. Платіжні та виплатні дані</h3>
            <p className={styles.text}>
              Ми <strong>не зберігаємо повні реквізити платіжних карток</strong> у власній базі даних, якщо інше
              прямо не зазначено в конкретному платіжному сценарії. Оплата та виплати обробляються через
              сторонніх платіжних провайдерів, насамперед <strong>Stripe</strong> та, за наявності, інших
              підключених провайдерів.
            </p>
            <p className={styles.text}>У зв’язку з оплатами і виплатами ми можемо отримувати або зберігати:</p>
            <ul className={styles.list}>
              <li>ідентифікатори транзакцій;</li>
              <li>статуси платежів, повернень, чарджбеків, виплат;</li>
              <li>
                часткові дані платіжного інструменту, надані платіжним провайдером (наприклад, бренд картки,
                останні цифри, країна, токенізовані дані);
              </li>
              <li>
                інформацію щодо одержувача виплати, статусу верифікації, країни, валюти, банківського або іншого
                payout-акаунта — у межах, необхідних для виплат і комплаєнсу.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>3. Для чого ми використовуємо персональні дані</h2>
            <p className={styles.text}>Ми використовуємо персональні дані для таких цілей:</p>
            <ul className={styles.list}>
              <li>створення та обслуговування акаунта;</li>
              <li>входу до Сервісу, авторизації та безпеки;</li>
              <li>надання доступу до цифрового контенту та функцій платформи;</li>
              <li>відображення, ведення та обліку внутрішнього балансу, транзакцій і придбань;</li>
              <li>обробки платежів, повернень, спорів, чарджбеків і виплат;</li>
              <li>проходження KYC/KYB, AML, anti-fraud та інших комплаєнс-процедур, якщо це потрібно;</li>
              <li>зв’язку з вами щодо акаунта, безпеки, платежів, оновлень правил та змін у Сервісі;</li>
              <li>відповіді на звернення, скарги та правові вимоги;</li>
              <li>виявлення зловживань, порушень правил, шахрайства, технічних проблем;</li>
              <li>аналітики, покращення функцій, стабільності та безпеки Сервісу;</li>
              <li>виконання юридичних обов’язків.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Правові підстави обробки (GDPR)</h2>
            <p className={styles.text}>Залежно від ситуації ми обробляємо персональні дані на підставі:</p>
            <ul className={styles.list}>
              <li>
                <strong>виконання договору</strong> або дій до укладення договору;
              </li>
              <li>
                <strong>виконання юридичного обов’язку</strong>;
              </li>
              <li>
                <strong>нашого законного інтересу</strong>, зокрема для безпеки, захисту від шахрайства, захисту
                прав, внутрішнього адміністрування та розвитку Сервісу;
              </li>
              <li>
                <strong>вашої згоди</strong>, якщо вона потрібна законом, зокрема для окремих cookies,
                маркетингових або необов’язкових технологій.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>5. Платежі, Stripe та інші провайдери</h2>
            <p className={styles.text}>
              Для приймання оплат, управління платіжними процесами, поверненнями, виплатами та верифікацією
              одержувачів ми використовуємо <strong>Stripe</strong> та, за потреби, інші платіжні сервіси.
            </p>
            <p className={styles.text}>Це означає, що певні персональні дані можуть передаватися Stripe для:</p>
            <ul className={styles.list}>
              <li>обробки оплати;</li>
              <li>запобігання шахрайству;</li>
              <li>дотримання фінансових і регуляторних вимог;</li>
              <li>
                обробки виплат через <strong>Stripe Connect</strong>;
              </li>
              <li>верифікації особи, бізнесу, банківського або payout-акаунта.</li>
            </ul>
            <p className={styles.text}>
              Політика конфіденційності Stripe:{" "}
              <a className={styles.link} href="https://stripe.com/privacy" target="_blank" rel="noreferrer">
                https://stripe.com/privacy
              </a>
            </p>
            <p className={styles.text}>
              Якщо ви є автором, перекладачем або іншим користувачем, який отримує виплати, Stripe або інший
              платіжний провайдер може збирати додаткові дані безпосередньо від вас у межах власних вимог
              KYC/KYB та платіжного законодавства.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>6. Соціальний вхід і сторонні сервіси</h2>
            <p className={styles.text}>
              Якщо ви використовуєте вхід через <strong>Meta / Facebook</strong>, <strong>Google</strong> або інші
              сторонні сервіси, відповідний провайдер може обробляти ваші дані згідно з власними політиками
              конфіденційності та умовами.
            </p>
            <p className={styles.text}>Ми рекомендуємо вам ознайомитися з політиками таких сервісів окремо.</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7. Cookies і подібні технології</h2>
            <p className={styles.text}>
              Ми використовуємо обов’язкові технічні cookies, а також можемо використовувати аналітичні,
              функціональні та інші подібні технології, якщо для цього є належна правова підстава.
            </p>
            <p className={styles.text}>
              Детальніше див.{" "}
              <Link className={styles.link} to="/cookie-policy">
                Політику cookies
              </Link>
              .
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>8. Кому ми передаємо дані</h2>
            <p className={styles.text}>Ми можемо передавати персональні дані:</p>
            <ul className={styles.list}>
              <li>платіжним сервісам і фінансовим партнерам, включно зі Stripe;</li>
              <li>хостинг-провайдерам, CDN, сервісам зберігання, безпеки, логування та моніторингу;</li>
              <li>сервісам email, повідомлень, підтримки, антиспаму, anti-fraud;</li>
              <li>сервісам авторизації та соціального входу;</li>
              <li>професійним консультантам, бухгалтерам, юристам, аудиторам — за потреби;</li>
              <li>
                державним органам, судам, правоохоронним та регуляторним органам, якщо це вимагається законом або
                необхідно для захисту наших прав.
              </li>
            </ul>
            <p className={styles.text}>Ми не продаємо ваші персональні дані як окремий товар.</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>9. Міжнародні передачі даних</h2>
            <p className={styles.text}>
              Оскільки ми використовуємо міжнародні технологічні та платіжні сервіси, ваші дані можуть
              передаватися за межі країни вашого проживання та, у деяких випадках, за межі Європейської економічної
              зони.
            </p>
            <p className={styles.text}>
              У таких випадках ми застосовуємо належні механізми захисту, передбачені GDPR, якщо вони потрібні.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>10. Як довго ми зберігаємо дані</h2>
            <p className={styles.text}>
              Ми зберігаємо дані не довше, ніж це необхідно для цілей, для яких їх було зібрано, зокрема для:
            </p>
            <ul className={styles.list}>
              <li>ведення акаунта та надання сервісу;</li>
              <li>бухгалтерського й податкового обліку;</li>
              <li>боротьби з шахрайством і забезпечення безпеки;</li>
              <li>розгляду спорів, претензій, чарджбеків і правових вимог;</li>
              <li>виконання вимог законодавства.</li>
            </ul>
            <p className={styles.text}>
              Конкретні строки можуть відрізнятися залежно від категорії даних і юридичних обов’язків.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>11. Ваші права</h2>
            <p className={styles.text}>Відповідно до GDPR ви можете мати право:</p>
            <ul className={styles.list}>
              <li>знати, які дані ми обробляємо;</li>
              <li>отримати доступ до своїх даних;</li>
              <li>виправити неточні дані;</li>
              <li>вимагати видалення даних у випадках, передбачених законом;</li>
              <li>обмежити обробку;</li>
              <li>заперечити проти окремих видів обробки;</li>
              <li>отримати дані у переносимому форматі, якщо це застосовно;</li>
              <li>відкликати згоду, якщо обробка ґрунтується на згоді;</li>
              <li>подати скаргу до компетентного органу із захисту даних.</li>
            </ul>
            <p className={styles.text}>
              Щоб реалізувати свої права, зверніться на:{" "}
              <strong>
                <a className={styles.link} href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </strong>
            </p>
            <p className={styles.text}>Ми можемо попросити вас підтвердити особу перед виконанням запиту.</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>12. Безпека</h2>
            <p className={styles.text}>
              Ми застосовуємо розумні технічні та організаційні заходи безпеки для захисту даних від
              несанкціонованого доступу, втрати, зловживання, зміни чи розголошення. Водночас жоден спосіб
              передачі або зберігання даних не є абсолютно безпечним, тому ми не можемо гарантувати абсолютну
              безпеку.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>13. Дані дітей</h2>
            <p className={styles.text}>
              Сервіс не призначений для використання особами, які не мають права укладати відповідні правочини за
              застосовним законодавством. Якщо ми дізнаємося, що персональні дані були надані з порушенням
              застосовних правил, ми можемо видалити такі дані або обмежити акаунт.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>14. Зміни до цієї Політики</h2>
            <p className={styles.text}>
              Ми можемо оновлювати цю Політику конфіденційності. Актуальна версія завжди публікується на сайті.
              Якщо зміни є суттєвими, ми можемо додатково повідомити вас через інтерфейс Сервісу або електронною
              поштою.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>15. Контакти</h2>
            <p className={styles.text}>З усіх питань щодо приватності, персональних даних або реалізації прав звертайтеся:</p>
            <p className={styles.text}>
              <strong>{LEGAL_NAME}</strong>
              <br />
              {ADDRESS_FULL}
              <br />
              IČO: {ICO}
              <br />
              Email:{" "}
              <a className={styles.link} href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </p>
          </section>
        </div>
      </Container>
    </section>
  );
}
