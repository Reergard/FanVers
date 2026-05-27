# SEO — Головний довідник (Frontend)

Дата: 2026-05-27

Цей файл — єдина точка входу у всю SEO-документацію проекту FanVers. Тут зібрані посилання на всі документи, короткий опис кожного, швидкий довідник ідентифікаторів та загальна архітектура.

---

## 1. Загальна архітектура SEO

```
                              ┌──────────────────────────────────┐
                              │         Користувач (браузер)      │
                              │  React SPA + Helmet мета-теги    │
                              │  GA4 + Meta Pixel + UTM          │
                              └───────────────┬──────────────────┘
                                              │
                                    ┌─────────┴─────────┐
                                    │      Nginx        │
                                    │  (бот-роутинг)    │
                                    └──┬──────────┬─────┘
                            бот?       │          │    користувач?
                              ┌────────┘          └────────┐
                              ▼                            ▼
                    ┌──────────────────┐         ┌────────────────┐
                    │  Django Backend  │         │  React SPA     │
                    │  - JSON-LD       │         │  - Helmet      │
                    │  - OG-теги       │         │  - GA4         │
                    │  - sitemap.xml   │         │  - Meta Pixel  │
                    │  - robots.txt    │         │  - UTM capture │
                    └────────┬─────────┘         └────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │  Google      │ │  Bing        │ │  AI-пошук    │
     │  (Googlebot) │ │  (bingbot)   │ │  (GPTBot,    │
     │              │ │              │ │   Gemini)    │
     └──────────────┘ └──────────────┘ └──────────────┘
```

**Принцип:** боти отримують готовий HTML від Django, користувачі — React SPA з динамічними трекерами.

---

## 2. Швидкий довідник ідентифікаторів

| Сервіс | ID / Ключ | Де зберігається | Інтерфейс |
|--------|-----------|-----------------|-----------|
| GA4 | `G-J9978WWKVX` | `frontend/src/analytics/ga4.ts` | `analytics.google.com` |
| Meta Pixel | `2102301083891760` | `frontend/src/analytics/metaPixel.ts` | `business.facebook.com` → Events Manager |
| Google Search Console | — | DNS TXT (Cloudflare) | `search.google.com/search-console` |
| Bing Webmaster Tools | — | DNS CNAME (Cloudflare) | `bing.com/webmasters` |
| Домен | `fan-vers.com` | Cloudflare DNS | `dash.cloudflare.com` |
| SSL | Let's Encrypt | `/etc/letsencrypt/live/fan-vers.com/` | автооновлення certbot |

---

## 3. Карта документів

### Frontend (`frontend/src/docs/`)

| Документ | Що описує | Для кого |
|----------|----------|----------|
| **`SEO_INDEX.md`** (цей файл) | Загальний довідник, архітектура, посилання | Усі |
| **`SEO_SYSTEM_FRONTEND.md`** | React Helmet мета-теги, alt-атрибути, `<title>` | Фронтенд-розробники |
| **`SEO_GA4_AND_TRACKING.md`** | GA4, Meta Pixel, UTM-мітки, AnalyticsProvider | SEO-спеціалісти, фронтенд-розробники |
| **`COOKIE_CONSENT_FRONTEND.md`** | Банер cookies, модалка, localStorage, синхронізація | Фронтенд-розробники |

### Backend (`backend/docs/`)

| Документ | Що описує | Для кого |
|----------|----------|----------|
| **`SEO_INDEX.md`** | Загальний довідник з боку бекенду | Усі |
| **`SEO_SYSTEM_BACKEND.md`** | Middleware для ботів, JSON-LD, sitemap, robots.txt | Бекенд-розробники, DevOps |
| **`SEO_EXTERNAL_ANALYTICS.md`** | GSC, Bing, GA4/Meta Pixel — бекенд-перспектива, DNS, nginx | DevOps, SEO-спеціалісти |
| **`COOKIE_CONSENT_BACKEND.md`** | API cookie consent, модель Profile | Бекенд-розробники |

---

## 4. Що де шукати (FAQ навігація)

| Питання | Документ |
|---------|----------|
| Як додати кастомну подію трекінгу? | `SEO_GA4_AND_TRACKING.md` → секції 7 та 10.3 |
| Як перевірити що GA4 працює? | `SEO_GA4_AND_TRACKING.md` → секція 9 |
| Як перевірити що Meta Pixel працює? | `SEO_GA4_AND_TRACKING.md` → секція 10.5 |
| Як змінити GA4 Measurement ID? | `SEO_GA4_AND_TRACKING.md` → секція 3.2 |
| Як змінити Meta Pixel ID? | `SEO_GA4_AND_TRACKING.md` → секція 10.2 |
| Як працює cookie consent? | `COOKIE_CONSENT_FRONTEND.md` |
| Як додати мета-теги для нової сторінки? | `SEO_SYSTEM_FRONTEND.md` |
| Де налаштовується JSON-LD? | `backend/docs/SEO_SYSTEM_BACKEND.md` |
| Як перевірити індексацію? | `backend/docs/SEO_EXTERNAL_ANALYTICS.md` → секція 3 |
| Як працює бот-роутинг (nginx)? | `backend/docs/SEO_EXTERNAL_ANALYTICS.md` → секція 9 |
| Як працює www→non-www редирект? | `backend/docs/SEO_EXTERNAL_ANALYTICS.md` → секція 8 |
| Чому GSC показує помилки 5xx? | `backend/docs/SEO_EXTERNAL_ANALYTICS.md` → секція 3.5 |
| Як додати UTM до рекламного посилання? | `SEO_GA4_AND_TRACKING.md` → секція 4 |

---

## 5. Файли коду (фронтенд)

### SEO (мета-теги)

```
frontend/src/seo/
├── bookSeo.ts            # Генерація title, description, alt, canonical
└── BookSeoHelmet.tsx      # React-компонент Helmet для книг
```

### Аналітика (GA4, Meta Pixel, UTM)

```
frontend/src/analytics/
├── ga4.ts                 # GA4: init/destroy/trackPageView/trackEvent
├── metaPixel.ts           # Meta Pixel: init/destroy/trackPixelEvent/trackPixelCustomEvent
├── utm.ts                 # UTM: captureUtm/getSavedUtm
├── AnalyticsProvider.tsx   # Renderless компонент: consent + routing + GA4 + Meta Pixel
└── index.ts               # Реекспорт усіх функцій
```

### Cookie consent (UI)

```
frontend/src/widgets/cookieConsent/
├── CookieConsentManager.tsx      # Головний менеджер
├── CookieBanner.tsx              # Банер
├── CookieSettingsModal.tsx        # Модалка налаштувань
└── CookieConsentManager.module.css

frontend/src/settings/
├── cookieConsentStore.ts          # Зовнішній store (localStorage)
├── useCookieConsent.ts            # React хук
├── useCookieConsentSync.ts        # Синхронізація з бекендом
└── cookieConsentApi.ts            # API виклики
```

---

## 6. Зведений чеклист: що зроблено і що залишилось

### Зроблено ✅

| Компонент | Статус |
|-----------|--------|
| GA4 інтеграція з GDPR consent | ✅ Працює |
| Meta Pixel інтеграція з GDPR consent | ✅ Працює |
| UTM capture та URL cleanup | ✅ Працює |
| SPA page view трекінг (GA4 + Meta Pixel) | ✅ Працює |
| React Helmet мета-теги | ✅ Працює |
| Cookie consent банер та модалка | ✅ Працює |
| Google Search Console верифікація | ✅ DNS TXT |
| Bing Webmaster Tools верифікація | ✅ DNS CNAME |
| Sitemap.xml | ✅ Динамічний |
| Robots.txt | ✅ |
| JSON-LD (Book schema) | ✅ |
| OG-теги для соцмереж | ✅ |
| www → non-www 301 redirect | ✅ nginx |

### Залишилось зробити 📋

| Задача | Пріоритет | Де реалізовувати |
|--------|-----------|-----------------|
| Зв'язати GA4 з Google Ads | Високий (перед запуском реклами) | GA4 інтерфейс |
| Зв'язати GA4 з Search Console | Середній | GA4 інтерфейс |
| Додати кастомні події GA4 (view_book, search, sign_up) | Середній | Фронтенд компоненти |
| Додати кастомні події Meta Pixel (ViewContent, Search, CompleteRegistration) | Середній | Фронтенд компоненти |
| Налаштувати Conversions в Meta Events Manager | Високий (перед запуском реклами) | Events Manager |
| Створити llms.txt | Низький | Бекенд |
| Додати Chapter JSON-LD schema | Низький | Бекенд |
| Додати ChapterSitemap | Низький | Бекенд |
| OG image автогенерація (Pillow) | Низький | Бекенд |
| Створити UTM-шаблони для рекламних кампаній | Середній | Документація |

---

Останнє оновлення: 2026-05-27
