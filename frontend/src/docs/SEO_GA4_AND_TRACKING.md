# Google Analytics 4, UTM-мітки та зовнішній трекінг (Frontend)

Дата: 2026-05-27

Коротко: фронтенд інтегрує **Google Analytics 4 (GA4)** та **UTM-трекінг** для відстеження трафіку, рекламних кампаній та поведінки користувачів. Усі зовнішні скрипти завантажуються **тільки після згоди на analytics cookies** (GDPR).

Пов'язана документація:
- Cookie consent UI та збереження: **`COOKIE_CONSENT_FRONTEND.md`**
- SEO мета-теги та Helmet: **`SEO_SYSTEM_FRONTEND.md`**
- SEO бекенд (middleware, JSON-LD, sitemap): **`backend/docs/SEO_SYSTEM_BACKEND.md`**
- Зовнішня аналітика з боку бекенду (GSC, Bing): **`backend/docs/SEO_EXTERNAL_ANALYTICS.md`**

---

## 1. Архітектура: загальна схема

```
Користувач заходить на сайт
         │
         ▼
┌─────────────────────────────┐
│  AnalyticsProvider (React)  │ ← renderless компонент в App.tsx
│  src/analytics/             │
└──────────┬──────────────────┘
           │
     ┌─────┴─────────────────┐
     │ Перевіряє consent     │
     │ (cookieConsentStore)  │
     └─────┬─────────────────┘
           │
     ┌─────┴─────┐
     │ analytics  │ analytics
     │ = true     │ = false (або null)
     ▼            ▼
  initGA4()     destroyGA4()
  captureUtm()  (скрипт НЕ завантажується)
     │
     ▼
  Кожна зміна маршруту → trackPageView()
```

**Ключовий принцип:** поки користувач не натисне «Прийняти всі» або не увімкне «Analytics» в налаштуваннях cookies — жоден зовнішній скрипт НЕ завантажується. Це забезпечує GDPR compliance.

---

## 2. Файли та структура

```
frontend/src/analytics/
├── ga4.ts                  # Модуль GA4: init/destroy/track
├── utm.ts                  # UTM-параметри: capture/clean/read
├── AnalyticsProvider.tsx   # React-компонент: зв'язує consent + routing + GA4
└── index.ts                # Реекспорт для зручного імпорту
```

**Точка підключення в додатку:**
```
frontend/src/App.tsx        # <AnalyticsProvider /> всередині <BrowserRouter>
```

---

## 3. Google Analytics 4 (GA4)

### 3.1. Що це і навіщо

GA4 — безкоштовний сервіс Google для аналітики вебсайтів. Збирає дані про:
- кількість відвідувачів та їх географію
- з яких джерел прийшли (Google, Instagram, Telegram, пряме посилання)
- які сторінки найпопулярніші
- як довго користувач перебуває на сайті
- з яких пристроїв заходять (телефон / комп'ютер)

GA4 критично важливий для рекламних кампаній: зв'язується з Google Ads і дозволяє оптимізувати рекламу на основі реальних даних.

### 3.2. Measurement ID

```
G-J9978WWKVX
```

Це унікальний ідентифікатор нашого GA4-ресурсу. Зашитий у файлі `ga4.ts`. Якщо потрібно змінити (наприклад, при переході на інший GA4-акаунт) — змінити **тільки в цьому файлі**.

### 3.3. Файл `ga4.ts` — детально

**Розташування:** `frontend/src/analytics/ga4.ts`

#### Константи

```typescript
const GA4_ID = "G-J9978WWKVX";
```

Єдине місце де зберігається ID. При зміні акаунту GA4 — правити тільки тут.

#### Функція `initGA4()`

Що робить:
1. Перевіряє чи GA4 вже ініціалізований (захист від повторного виклику)
2. Створює `<script>` тег з `src="https://www.googletagmanager.com/gtag/js?id=G-J9978WWKVX"` і додає його в `<head>`
3. Ініціалізує глобальні об'єкти `window.dataLayer` та `window.gtag`
4. Викликає `gtag('config', ...)` з `send_page_view: false` (ми відправляємо page view вручну при кожній навігації по SPA)

Коли викликається: автоматично з `AnalyticsProvider` коли `consent.analytics === true`.

#### Функція `destroyGA4()`

Що робить:
1. Видаляє `<script>` тег з DOM
2. Встановлює прапорець `ga-disable-G-J9978WWKVX` — офіційний механізм opt-out від Google
3. Скидає стан `initialized = false`

Коли викликається: автоматично коли користувач відкликає згоду на analytics cookies.

#### Функція `trackPageView(path, title?)`

Що робить: відправляє подію `page_view` в GA4 з поточним шляхом та заголовком сторінки.

Коли викликається: автоматично при кожній зміні маршруту (SPA-навігація). Це необхідно тому що GA4 за замовчуванням фіксує тільки початкове завантаження сторінки, а React-навігація не генерує нових HTTP-запитів.

#### Функція `trackEvent(eventName, params?)`

Що робить: відправляє кастомну подію в GA4.

Приклад використання (у будь-якому компоненті):

```typescript
import { trackEvent } from "../analytics";

// Коли користувач додає книгу в закладки:
trackEvent("add_to_bookmarks", {
  book_slug: "solo-leveling",
  book_title: "Підняття рівня в одиночку",
});

// Коли користувач використовує пошук:
trackEvent("search", {
  search_term: "фентезі ісекай",
});
```

**Важливо:** `trackEvent` автоматично перевіряє чи GA4 ініціалізований. Якщо користувач не дав згоду — виклик просто ігнорується, помилки не буде.

#### TypeScript декларації

В кінці файлу розширюється інтерфейс `Window`:

```typescript
declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}
```

Це дозволяє TypeScript розуміти що `window.dataLayer` та `window.gtag` — легітимні властивості.

---

## 4. UTM-мітки

### 4.1. Що це і навіщо

UTM (Urchin Tracking Module) — стандартні параметри в URL для відстеження джерел трафіку.

Приклад рекламного посилання:
```
https://fan-vers.com/books/solo-leveling/?utm_source=instagram&utm_medium=ad&utm_campaign=summer2026
```

GA4 автоматично розпізнає ці параметри і показує в звітах:
- **utm_source** — звідки прийшов (instagram, google, telegram)
- **utm_medium** — тип каналу (ad, post, email, referral)
- **utm_campaign** — назва кампанії (summer2026, black_friday)
- **utm_content** — варіант оголошення (для A/B тестів)
- **utm_term** — ключове слово (для пошукової реклами)

### 4.2. Приховування UTM з URL

Проблема: користувач бачить довгий «брудний» URL з параметрами.
Рішення: після збереження UTM — URL автоматично очищається.

Користувач бачить:
```
✗ fan-vers.com/books/solo-leveling/?utm_source=instagram&utm_medium=ad&utm_campaign=summer2026
✓ fan-vers.com/books/solo-leveling/
```

Це реалізовано через `window.history.replaceState()` — змінює URL в адресному рядку **без перезавантаження сторінки**.

### 4.3. Файл `utm.ts` — детально

**Розташування:** `frontend/src/analytics/utm.ts`

#### Константи

```typescript
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const STORAGE_KEY = "fv_utm";
```

#### Функція `captureUtm()`

Послідовність дій:
1. Читає `window.location.search` (параметри URL)
2. Шукає UTM-ключі серед параметрів
3. Якщо знайдено хоча б один — зберігає в `sessionStorage` (ключ `fv_utm`)
4. Видаляє UTM-параметри з URL через `history.replaceState`
5. НЕ-UTM параметри (якщо є) залишаються в URL

**Збереження в sessionStorage** (а не localStorage) означає:
- Дані живуть поки відкрита вкладка
- Коли вкладка закривається — дані зникають
- Це first-touch модель: зберігається тільки перший набір UTM за сесію

#### Функція `getSavedUtm()`

Повертає збережені UTM-дані або `null`. Використовується для передачі UTM у бекенд або в інші трекери (наприклад, Meta Pixel).

#### Порядок виконання (важливо!)

```
1. GA4 скрипт завантажується (initGA4)
2. GA4 читає URL і фіксує UTM параметри
3. captureUtm() зберігає UTM в sessionStorage
4. captureUtm() очищає URL
```

GA4 встигає прочитати UTM **до** очищення, тому атрибуція зберігається. Це гарантовано порядком виклику в `AnalyticsProvider`: спочатку `initGA4()` (в useEffect на consent), потім `captureUtm()` (в useEffect на mount).

---

## 5. AnalyticsProvider — React-компонент

**Розташування:** `frontend/src/analytics/AnalyticsProvider.tsx`

### Що робить

Це **renderless** компонент (повертає `null`, нічого не малює). Він зв'язує три системи:
1. **Cookie consent** — визначає чи можна трекати
2. **GA4** — зовнішній трекінг
3. **React Router** — відстеження навігації в SPA

### Як працює

```
Mount → captureUtm() (один раз)
      → підписка на consent

consent.analytics змінився?
  → true:  initGA4()
  → false: destroyGA4()

location змінився?
  → якщо analytics дозволено → trackPageView(path)
```

### Де підключений

**Файл:** `frontend/src/App.tsx`

```tsx
import { AnalyticsProvider } from "./analytics/AnalyticsProvider";

// ...

<BrowserRouter>
  <AnalyticsProvider />       {/* ← тут, всередині BrowserRouter */}
  <AuthModalProvider>
    <ScrollToTop />
    <Base>
      <Routes>...</Routes>
    </Base>
  </AuthModalProvider>
</BrowserRouter>
```

**Чому всередині `<BrowserRouter>`?** Тому що `AnalyticsProvider` використовує `useLocation()` з react-router для відстеження навігації. Без `BrowserRouter` — хук не працює.

**Чому перед `<AuthModalProvider>`?** Щоб трекінг починав працювати якнайшвидше, до рендерингу UI.

### Реактивність на зміну consent

Компонент використовує `useSyncExternalStore` (React 18+) для підписки на зміни в `cookieConsentStore`. Це означає:

1. Користувач натиснув «Прийняти всі» → `setCookieConsent()` оновлює localStorage
2. `subscribeCookieConsent` сповіщує всіх підписників
3. `AnalyticsProvider` перерендерюється
4. `useEffect` бачить `analyticsAllowed = true` → викликає `initGA4()`

Аналогічно при відкликанні згоди → `destroyGA4()`.

---

## 6. Зв'язок з cookie consent

### Модель даних

```typescript
CookieConsent = {
  necessary: true,       // завжди true, системні cookies
  preferences: boolean,  // налаштування UI (теми, мова)
  analytics: boolean     // ← GA4 та Meta Pixel залежать від цього
}
```

### Логіка в коді

```typescript
// В AnalyticsProvider.tsx:
const consent = useSyncExternalStore(subscribeCookieConsent, getCookieConsent);
const analyticsAllowed = consent?.analytics === true;

// consent === null → користувач ще не обрав → НЕ трекаємо
// consent.analytics === false → відмовився → НЕ трекаємо
// consent.analytics === true → погодився → трекаємо
```

### Чому це важливо для GDPR

**GDPR (та ePrivacy Directive)** вимагають:
- Не збирати дані до згоди (opt-in модель)
- Дозволити відкликання згоди в будь-який момент
- Зупинити збір при відкликанні

Наша реалізація:
- ✅ GA4 НЕ завантажується до згоди (скрипт навіть не додається в DOM)
- ✅ При відкликанні — скрипт видаляється + opt-out прапорець
- ✅ Банер показується при першому візиті

**Без цього Meta може заблокувати рекламний акаунт**, а Google може обмежити GA4.

---

## 7. Як додати трекінг кастомних подій

### Приклад: трекінг перегляду книги

```typescript
// У компоненті BookDetailReader.tsx:
import { trackEvent } from "../analytics";

useEffect(() => {
  trackEvent("view_book", {
    book_slug: book.slug,
    book_title: book.title,
    book_genre: book.genres?.map(g => g.name).join(", ") ?? "",
  });
}, [book.slug]);
```

### Приклад: трекінг пошуку

```typescript
// У компоненті SearchPage.tsx:
import { trackEvent } from "../analytics";

function handleSearch(query: string) {
  trackEvent("search", { search_term: query });
  // ... виконати пошук
}
```

### Приклад: трекінг реєстрації

```typescript
trackEvent("sign_up", { method: "email" });
trackEvent("sign_up", { method: "google_oauth" });
```

**Важливо:** всі `trackEvent` виклики безпечні — якщо GA4 не ініціалізований (немає згоди), вони просто ігноруються.

---

## 8. Enhanced Measurement (автоматичні події)

В GA4 увімкнено **Enhanced Measurement** — це автоматичний трекінг без додаткового коду:

| Подія | Що відстежує | Потрібен додатковий код? |
|-------|-------------|------------------------|
| `page_view` | Перегляд сторінки | Ні (ми відправляємо вручну для SPA) |
| `scroll` | Прокрутка до 90% сторінки | Ні |
| `click` | Кліки на зовнішні посилання | Ні |
| `site_search` | Пошук на сайті (якщо URL містить `?q=`) | Ні |
| `form_start` | Початок заповнення форми | Ні |
| `form_submit` | Відправка форми | Ні |

Це налаштовується в інтерфейсі GA4 (Analytics → Admin → Data Streams → Enhanced Measurement).

---

## 9. Налагодження та тестування

### Локально (dev)

1. Відкрий сайт в dev-режимі
2. Прийми cookies (натисни «Прийняти всі» в банері)
3. Відкрий DevTools → Network → фільтр `google`
4. Повинні з'явитися запити до `googletagmanager.com` та `google-analytics.com`
5. Перейди на іншу сторінку — побачиш нові запити (page_view)

### На продакшені

1. Встанови розширення **«Google Analytics Debugger»** або **«Tag Assistant»** для Chrome
2. Зайди на `fan-vers.com`
3. Прийми cookies
4. Розширення покаже що GA4 працює та які події відправляються

### В GA4 інтерфейсі

1. Зайди на `analytics.google.com`
2. Обери ресурс `FanVers`
3. Звіти → Реальний час — побачиш свої візити
4. Якщо сайт щойно запущений — дані з'являються з затримкою до 48 годин

### Перевірка GDPR compliance

1. Відкрий сайт в режимі інкогніто
2. НЕ натискай банер cookies
3. DevTools → Network → фільтр `google` → **повинно бути порожньо**
4. Натисни «Прийняти всі» → з'являться запити Google
5. Відкрий налаштування cookies → вимкни Analytics → запити зникнуть

---

## 10. Підготовка до Meta Pixel (майбутнє)

Архітектура вже підготовлена для Meta Pixel. Коли з'явиться Pixel ID:

1. Створити файл `frontend/src/analytics/metaPixel.ts` (аналогічно `ga4.ts`)
2. Додати `initMetaPixel()` / `destroyMetaPixel()` з тією ж логікою consent
3. В `AnalyticsProvider.tsx` додати виклики поруч з GA4:
   ```typescript
   useEffect(() => {
     if (analyticsAllowed) {
       initGA4();
       initMetaPixel();    // ← додати
     } else {
       destroyGA4();
       destroyMetaPixel(); // ← додати
     }
   }, [analyticsAllowed]);
   ```

Meta Pixel також має завантажуватися **тільки після согласія** — інакше Meta заблокує рекламний акаунт.

---

## 11. Зв'язок GA4 з іншими системами

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Google Ads  │◄───►│     GA4      │◄───►│  Google      │
│  (реклама)   │     │  (аналітика) │     │  Search      │
│              │     │              │     │  Console     │
└──────────────┘     └──────────────┘     └──────────────┘
                            ▲
                            │ збирає дані через
                            │ gtag.js на сайті
                            │
                     ┌──────────────┐
                     │  FanVers     │
                     │  (фронтенд)  │
                     └──────────────┘
```

- **GA4 + Google Ads:** коли запустиш рекламу — GA4 автоматично передає дані в Ads для оптимізації. Зв'язування відбувається в інтерфейсі GA4 (Admin → Product Links → Google Ads).
- **GA4 + Search Console:** зв'язування показує в GA4 по яких пошукових запитах тебе знаходять. Налаштовується в GA4 (Admin → Product Links → Search Console).
- **UTM-мітки:** Google Ads автоматично додає UTM до рекламних посилань. GA4 автоматично розпізнає їх у звітах.

---

## 12. Залежності

| Пакет | Чи встановлений | Навіщо |
|-------|-----------------|--------|
| gtag.js | Завантажується динамічно | Скрипт GA4 від Google CDN |
| — | — | Зовнішніх npm-пакетів НЕ потрібно |

GA4 не вимагає жодних npm-пакетів. Скрипт `gtag.js` завантажується з CDN Google динамічно через `<script>` тег.

---

## 13. FAQ

**Q: Що буде якщо GA4 Measurement ID зміниться?**
A: Змінити рядок `GA4_ID` в `frontend/src/analytics/ga4.ts`. Більше нічого міняти не потрібно.

**Q: Чи впливає GA4 на швидкість сайту?**
A: Скрипт `gtag.js` (~50 KB) завантажується з `async` атрибутом — він не блокує рендеринг сторінки. Вплив на швидкість мінімальний.

**Q: Чи бачить GA4 бот-трафік?**
A: Ні. Боти не виконують JavaScript, тому GA4 скрипт для них не існує. GA4 бачить тільки реальних користувачів.

**Q: Що якщо користувач заблокував cookies?**
A: GA4 працює і без cookies (в обмеженому режимі). Але якщо користувач не дав згоду через наш банер — скрипт навіть не завантажиться.

**Q: Як перевірити що UTM працює?**
A: Зайди на `fan-vers.com/?utm_source=test&utm_medium=test`. URL повинен очиститися. В DevTools → Application → Session Storage → побачиш `fv_utm` з збереженими параметрами. В GA4 → Realtime → побачиш source = test.

**Q: Де переглядати звіти GA4?**
A: `analytics.google.com` → обрати ресурс FanVers → Звіти. Основні розділи: Реальний час, Залучення (звідки трафік), Утримання (як довго на сайті), Монетизація (конверсії).

**Q: trackEvent виклики — обов'язкові?**
A: Ні. Enhanced Measurement автоматично збирає базові дані. Кастомні події (`trackEvent`) — для додаткової деталізації (перегляд книги, додавання в обране тощо). Додавати за потребою.

---

## 14. Чеклист для SEO-спеціаліста

- [ ] GA4 Measurement ID: `G-J9978WWKVX` (файл `ga4.ts`)
- [ ] GA4 інтерфейс: `analytics.google.com`
- [ ] Enhanced Measurement увімкнено в GA4 (page_view, scroll, click, search)
- [ ] Cookie consent контролює завантаження GA4 (GDPR)
- [ ] UTM-параметри підтримуються і зберігаються в sessionStorage
- [ ] URL очищується від UTM після збереження
- [ ] Для нових кастомних подій — використовувати `trackEvent()` з `analytics/index.ts`
- [ ] Для Meta Pixel — створити `metaPixel.ts` за аналогією з `ga4.ts`
- [ ] Зв'язати GA4 з Google Ads та Search Console в інтерфейсі GA4

---

Останнє оновлення: 2026-05-27
