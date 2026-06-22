# Google Analytics 4, Meta Pixel, UTM-мітки та зовнішній трекінг (Frontend)

Дата: 2026-06-22

Коротко: фронтенд інтегрує **Google Analytics 4 (GA4)**, **Meta Pixel (Facebook/Instagram)** та **UTM-трекінг** для відстеження трафіку, рекламних кампаній та поведінки користувачів. Усі зовнішні скрипти завантажуються **тільки після згоди на analytics cookies** (GDPR).

Пов'язана документація:
- Головний довідник SEO: **`SEO_INDEX.md`**
- Cookie consent UI та збереження: **`COOKIE_CONSENT_FRONTEND.md`**
- SEO мета-теги та Helmet: **`SEO_SYSTEM_FRONTEND.md`**
- SEO бекенд (middleware, JSON-LD, sitemap): **`backend/docs/SEO_SYSTEM_BACKEND.md`**
- Зовнішня аналітика з боку бекенду (GSC, Bing, nginx): **`backend/docs/SEO_EXTERNAL_ANALYTICS.md`**

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
     ├─── captureUtm() (завжди, один раз при mount)
     │
     ┌─────┴─────┐
     │ analytics  │ analytics
     │ = true     │ = false (або null)
     ▼            ▼
  initGA4()       destroyGA4()
  initMetaPixel() destroyMetaPixel()
     │            (скрипти НЕ завантажуються)
     ▼
  Кожна зміна маршруту → trackPageView() (GA4)
                       → trackPixelEvent("PageView") (Meta Pixel)
```

**Ключовий принцип:** поки користувач не натисне «Прийняти всі» або не увімкне «Analytics» в налаштуваннях cookies — жоден зовнішній скрипт НЕ завантажується. Це забезпечує GDPR compliance.

---

## 2. Файли та структура

```
frontend/src/analytics/
├── ga4.ts                  # Модуль GA4: init/destroy/track
├── metaPixel.ts            # Модуль Meta Pixel: init/destroy/track
├── utm.ts                  # UTM-параметри: capture/clean/read
├── AnalyticsProvider.tsx   # React-компонент: зв'язує consent + routing + GA4 + Meta Pixel
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

Це **renderless** компонент (повертає `null`, нічого не малює). Він зв'язує чотири системи:
1. **Cookie consent** — визначає чи можна трекати
2. **GA4** — Google Analytics трекінг
3. **Meta Pixel** — Facebook/Instagram трекінг
4. **React Router** — відстеження навігації в SPA

### Як працює

```
Mount → captureUtm() (один раз)
      → підписка на consent

consent.analytics змінився?
  → true:  initGA4() + initMetaPixel()
  → false: destroyGA4() + destroyMetaPixel()

location змінився?
  → якщо analytics дозволено → trackPageView(path)        [GA4]
                              → trackPixelEvent("PageView") [Meta Pixel]
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
4. `useEffect` бачить `analyticsAllowed = true` → викликає `initGA4()` + `initMetaPixel()`

Аналогічно при відкликанні згоди → `destroyGA4()` + `destroyMetaPixel()`.

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
const consent = useSyncExternalStore(
  subscribeCookieConsent,
  getCookieConsent,
  getCookieConsent,  // server snapshot (SSR fallback)
);
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

## 10. Meta Pixel (Facebook/Instagram)

### 10.1. Що це і навіщо

Meta Pixel — JavaScript-код від Meta (Facebook/Instagram) для відстеження дій користувачів на сайті. Необхідний для:
- **Рекламних кампаній** в Facebook та Instagram — Pixel збирає дані для оптимізації реклами
- **Ретаргетингу** — показувати рекламу людям які вже відвідали сайт
- **Конверсій** — вимірювати ефективність рекламних кампаній
- **Lookalike аудиторій** — Meta знаходить схожих користувачів для розширення охоплення

**Без Pixel неможливо ефективно запускати рекламу в Facebook/Instagram.**

### 10.2. Pixel ID та рекламна інфраструктура Meta

```
Pixel ID:           988312620871477
Рекламний акаунт:   2118256932432323 (назва: FanVers)
Business Portfolio:  FanVers (business.facebook.com)
```

Pixel ID — унікальний ідентифікатор нашого Meta Pixel (Dataset «FanVers»). Зашитий у файлі `metaPixel.ts`. Якщо потрібно змінити — правити **тільки в цьому файлі**.

**Організаційна структура Meta Business:**
```
Business Portfolio (FanVers) — прив'язане до компанії, не до особистого профілю
├── Рекламний акаунт FanVers (ID: 2118256932432323)
│   └── Пов'язаний з Pixel FanVers
└── Meta Pixel / Dataset FanVers (ID: 988312620871477)
```

Business Portfolio дозволяє в майбутньому додавати інші незалежні сайти та проекти, не змішуючи їх налаштування.

**Де подивитися Pixel ID:** `business.facebook.com` → Events Manager → Data Sources → обрати піксель → Settings.

### 10.3. Файл `metaPixel.ts` — детально

**Розташування:** `frontend/src/analytics/metaPixel.ts`

#### Константи

```typescript
const PIXEL_ID = "988312620871477";
```

Єдине місце де зберігається Pixel ID. При зміні — правити тільки тут.

#### Функція `initMetaPixel()`

Що робить:
1. Перевіряє чи Pixel вже ініціалізований (захист від повторного виклику)
2. Створює **fbq stub** — функцію-заглушку яка збирає виклики в чергу поки основний скрипт `fbevents.js` не завантажиться
3. Додає `<script>` тег з `src="https://connect.facebook.net/en_US/fbevents.js"` в `<head>`
4. Викликає `fbq('init', PIXEL_ID)` — реєструє піксель
5. Викликає `fbq('track', 'PageView')` — відправляє перший перегляд сторінки

**Fbq stub** — це стандартний патерн від Meta. Суть: поки `fbevents.js` ще завантажується (це асинхронний процес), всі виклики `fbq()` збираються в чергу (`fbq.queue`). Коли скрипт завантажиться — він обробить чергу.

Коли викликається: автоматично з `AnalyticsProvider` коли `consent.analytics === true`.

#### Функція `destroyMetaPixel()`

Що робить:
1. Видаляє `<script>` тег з DOM
2. Очищає `window.fbq` та `window._fbq`
3. Скидає стан `initialized = false`

Коли викликається: автоматично коли користувач відкликає згоду на analytics cookies.

#### Функція `trackPixelEvent(eventName, params?)`

Що робить: відправляє **стандартну подію** Meta Pixel.

Стандартні події Meta (відповідають рекламним цілям):

| Подія | Коли використовувати |
|-------|---------------------|
| `PageView` | Перегляд сторінки (відправляється автоматично при навігації) |
| `ViewContent` | Перегляд конкретного контенту (книги) |
| `Search` | Пошук на сайті |
| `AddToWishlist` | Додавання в обране/закладки |
| `CompleteRegistration` | Реєстрація нового користувача |
| `Lead` | Користувач зацікавився (наприклад, підписка на оновлення) |

Приклад використання:

```typescript
import { trackPixelEvent } from "../analytics";

// Перегляд книги:
trackPixelEvent("ViewContent", {
  content_name: "Підняття рівня в одиночку",
  content_category: "ранобе",
  content_ids: "solo-leveling",
  content_type: "product",
});

// Пошук:
trackPixelEvent("Search", {
  search_string: "фентезі ісекай",
});

// Реєстрація:
trackPixelEvent("CompleteRegistration", {
  content_name: "email_signup",
});
```

#### Функція `trackPixelCustomEvent(eventName, params?)`

Що робить: відправляє **кастомну подію** (для нестандартних дій які не входять у список Meta).

```typescript
import { trackPixelCustomEvent } from "../analytics";

// Кастомна подія: читання розділу
trackPixelCustomEvent("ReadChapter", {
  book_slug: "solo-leveling",
  chapter_number: "42",
});
```

**Різниця між стандартними та кастомними подіями:**
- **Стандартні** (`trackPixelEvent`) — Meta розуміє їх і використовує для оптимізації реклами (рекомендується використовувати де можливо)
- **Кастомні** (`trackPixelCustomEvent`) — для ваших унікальних подій, Meta не оптимізує під них автоматично, але вони доступні в звітах

**Важливо:** обидві функції безпечні — якщо Pixel не ініціалізований (немає згоди), виклики просто ігноруються.

#### TypeScript декларації

В кінці файлу розширюється інтерфейс `Window`:

```typescript
declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
  }
}
```

### 10.4. Як Meta Pixel працює з SPA-навігацією

В звичайному (не-SPA) сайті кожна сторінка завантажується заново і Pixel автоматично фіксує `PageView`. В React SPA сторінки змінюються без перезавантаження, тому `AnalyticsProvider` вручну відправляє `PageView` при кожній навігації:

```
Перша сторінка:
  initMetaPixel() → fbq('track', 'PageView')   ← відправляється в initMetaPixel

Наступні сторінки (SPA-навігація):
  trackPixelEvent("PageView")                    ← відправляється в AnalyticsProvider
```

### 10.5. Налагодження Meta Pixel

#### Локально (dev)

1. Відкрий сайт в dev-режимі
2. Прийми cookies (натисни «Прийняти всі»)
3. Встанови розширення **«Meta Pixel Helper»** для Chrome
4. Зайди на сайт — розширення покаже що Pixel працює та які події відправляються
5. Перейди на іншу сторінку — побачиш нову подію `PageView`

#### На продакшені

1. Зайди на `fan-vers.com` з встановленим **Meta Pixel Helper**
2. Прийми cookies
3. Розширення покаже зелену іконку ✓ та список подій

#### В Meta Events Manager

1. Зайди на `business.facebook.com` → Events Manager
2. Обери піксель `988312620871477`
3. Вкладка **Test Events** — покаже події в реальному часі (потрібно вказати URL сайту)
4. Вкладка **Overview** — загальна статистика подій (дані з затримкою до 20 хвилин)

#### Перевірка GDPR compliance

1. Відкрий сайт в режимі інкогніто
2. НЕ натискай банер cookies
3. DevTools → Network → фільтр `facebook` → **повинно бути порожньо**
4. Натисни «Прийняти всі» → з'являться запити до `connect.facebook.net`
5. Вимкни Analytics в налаштуваннях cookies → запити зникнуть

### 10.6. Зв'язок Meta Pixel з рекламою

```
┌───────────────────────────────────────────────────────────┐
│              Business Portfolio «FanVers»                  │
│              (business.facebook.com)                       │
│                                                           │
│  ┌──────────────────┐     ┌──────────────────────────┐   │
│  │  Рекламний акаунт│     │  Meta Pixel / Dataset    │   │
│  │  FanVers         │◄───►│  FanVers                 │   │
│  │  (ID: 211825...) │     │  (ID: 988312...)         │   │
│  └────────┬─────────┘     └────────────┬─────────────┘   │
│           │                            │                  │
│  ┌────────┴─────────┐     ┌────────────┴─────────────┐   │
│  │  Facebook Ads    │     │  Events Manager          │   │
│  │  Instagram Ads   │     │  (звіти, конверсії)      │   │
│  └──────────────────┘     └──────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
                                     ▲
                                     │ fbevents.js
                                     │
                              ┌──────────────┐
                              │  FanVers     │
                              │  (фронтенд)  │
                              └──────────────┘
```

- **Business Portfolio:** усі рекламні ресурси (акаунт, піксель) зібрані під компанію, а не під особистий профіль. Це дозволяє додавати інші проекти/сайти незалежно.
- **Meta Pixel + Facebook/Instagram Ads:** Pixel автоматично передає дані в Ads Manager для оптимізації. Рекламні кампанії можуть оптимізуватися під `ViewContent`, `CompleteRegistration` тощо.
- **Ретаргетинг:** Pixel дозволяє створювати аудиторії «люди які відвідали сайт за останні 30 днів» і показувати їм рекламу.
- **Lookalike:** Meta знаходить людей схожих на ваших відвідувачів і показує їм рекламу.

### 10.7. Залежності Meta Pixel

| Пакет | Чи встановлений | Навіщо |
|-------|-----------------|--------|
| fbevents.js | Завантажується динамічно | Скрипт Meta Pixel від Facebook CDN |
| — | — | Зовнішніх npm-пакетів НЕ потрібно |

Meta Pixel не вимагає жодних npm-пакетів. Скрипт `fbevents.js` завантажується з CDN Facebook динамічно.

---

## 11. Зв'язок GA4 та Meta Pixel з іншими системами

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Google Ads  │◄───►│     GA4      │◄───►│  Google      │
│  (реклама)   │     │  (аналітика) │     │  Search      │
│              │     │              │     │  Console     │
└──────────────┘     └──────────────┘     └──────────────┘
                            ▲
                            │ gtag.js
                            │
                     ┌──────────────┐
                     │  FanVers     │
                     │  (фронтенд)  │
                     └──────────────┘
                            │
                            │ fbevents.js
                            ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Facebook    │◄───►│  Meta Pixel  │◄───►│  Events      │
│  Ads Manager │     │  (трекінг)   │     │  Manager     │
│  + Instagram │     │              │     │  (звіти)     │
└──────────────┘     └──────────────┘     └──────────────┘
```

- **GA4 + Google Ads:** коли запустиш рекламу — GA4 автоматично передає дані в Ads для оптимізації. Зв'язування відбувається в інтерфейсі GA4 (Admin → Product Links → Google Ads).
- **GA4 + Search Console:** зв'язування показує в GA4 по яких пошукових запитах тебе знаходять. Налаштовується в GA4 (Admin → Product Links → Search Console).
- **Meta Pixel + Facebook/Instagram Ads:** Pixel передає дані для оптимізації реклами. Налаштовується в Ads Manager при створенні кампанії.
- **UTM-мітки:** Google Ads і Facebook Ads автоматично додають UTM до рекламних посилань. GA4 автоматично розпізнає їх у звітах.

---

## 12. Залежності

| Пакет | Чи встановлений | Навіщо |
|-------|-----------------|--------|
| gtag.js | Завантажується динамічно | Скрипт GA4 від Google CDN |
| fbevents.js | Завантажується динамічно | Скрипт Meta Pixel від Facebook CDN |
| — | — | Зовнішніх npm-пакетів НЕ потрібно |

GA4 та Meta Pixel не вимагають жодних npm-пакетів. Скрипти завантажуються з CDN динамічно через `<script>` теги.

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

**Q: Що буде якщо Meta Pixel ID зміниться?**
A: Змінити рядок `PIXEL_ID` в `frontend/src/analytics/metaPixel.ts`. Більше нічого міняти не потрібно.

**Q: Чи можна використовувати GA4 і Meta Pixel одночасно?**
A: Так. Вони працюють незалежно і не конфліктують. Обидва завантажуються/знищуються одночасно через `AnalyticsProvider`.

**Q: Де подивитися дані Meta Pixel?**
A: `business.facebook.com` → Events Manager → обрати піксель. Вкладки: Overview (загальна статистика), Test Events (тестування в реальному часі), Diagnostics (помилки).

**Q: Чи впливає Meta Pixel на швидкість сайту?**
A: Скрипт `fbevents.js` (~60 KB) завантажується з `async` атрибутом — не блокує рендеринг. Вплив мінімальний, аналогічно GA4.

**Q: Що якщо Meta заблокує рекламний акаунт через GDPR?**
A: Перевірити що Pixel завантажується **тільки після згоди** на analytics cookies. Наша архітектура це гарантує — `AnalyticsProvider` перевіряє `consent.analytics === true` перед `initMetaPixel()`.

---

## 14. Чеклист для SEO-спеціаліста

### GA4
- [x] GA4 Measurement ID: `G-J9978WWKVX` (файл `ga4.ts`)
- [x] GA4 інтерфейс: `analytics.google.com`
- [x] Enhanced Measurement увімкнено в GA4 (page_view, scroll, click, search)
- [x] Cookie consent контролює завантаження GA4 (GDPR)
- [x] SPA page view трекінг працює (AnalyticsProvider)
- [ ] Зв'язати GA4 з Google Ads в інтерфейсі GA4 (Admin → Product Links)
- [ ] Зв'язати GA4 з Search Console в інтерфейсі GA4 (Admin → Product Links)
- [ ] Додати кастомні події (`trackEvent`) для ключових дій (перегляд книги, пошук, реєстрація)

### Meta Pixel
- [x] Business Portfolio «FanVers» створено в `business.facebook.com`
- [x] Рекламний акаунт FanVers (ID: `2118256932432323`) створено
- [x] Meta Pixel (ID: `988312620871477`) створено та пов'язано з рекламним акаунтом
- [x] Pixel ID оновлено у файлі `metaPixel.ts`
- [x] Meta Events Manager: `business.facebook.com` → Events Manager
- [x] Cookie consent контролює завантаження Meta Pixel (GDPR)
- [x] SPA PageView трекінг працює (AnalyticsProvider)
- [ ] Додати кастомні події (`trackPixelEvent`) для ключових дій (ViewContent, Search, CompleteRegistration)
- [ ] Налаштувати Conversions в Events Manager (визначити які події є конверсіями)

### UTM
- [x] UTM-параметри підтримуються і зберігаються в sessionStorage
- [x] URL очищується від UTM після збереження
- [ ] Створити UTM-шаблони для рекламних кампаній (Google Ads, Facebook Ads, Telegram)

---

Останнє оновлення: 2026-06-22
