# SEO — Головний довідник (Backend)

Дата: 2026-05-27

Цей файл — єдина точка входу у всю SEO-документацію з боку бекенду. Тут зібрані посилання, швидкий довідник та загальна архітектура.

---

## 1. Роль бекенду в SEO

Бекенд (Django) відповідає за те, щоб **пошукові боти** (Google, Bing, ChatGPT, Gemini) бачили повноцінний контент сайту. Без бекенд-SEO боти бачать лише порожній `<div id="root">` — React SPA без JavaScript для них невидимий.

```
Бот заходить на /books/my-book/
        │
        ▼
   ┌──────────┐
   │  Nginx   │ ← визначає що це бот (User-Agent)
   └────┬─────┘
        │ проксує на Django
        ▼
   ┌──────────────────────────────┐
   │  Django (SeoPrerendererMW)   │
   │  - <title>, <meta>          │
   │  - og:image, og:title       │
   │  - JSON-LD (schema.org)     │
   │  - canonical URL            │
   └──────────────────────────────┘
        │
        ▼
   Бот отримує повноцінний HTML
```

Бекенд **не завантажує** GA4, Meta Pixel або інші клієнтські скрипти — це робить фронтенд.

---

## 2. Швидкий довідник

| Сервіс | ID / Ключ | Інтерфейс |
|--------|-----------|-----------|
| GA4 Measurement ID | `G-J9978WWKVX` | `analytics.google.com` |
| Meta Pixel ID | `2102301083891760` | `business.facebook.com` → Events Manager |
| Google Search Console | DNS TXT верифікація | `search.google.com/search-console` |
| Bing Webmaster Tools | DNS CNAME верифікація | `bing.com/webmasters` |
| Канонічний домен | `fan-vers.com` (не www) | 301 redirect в nginx |
| Sitemap | `/sitemap.xml` (динамічний) | `fan-vers.com/sitemap.xml` |
| Robots.txt | `/robots.txt` | `fan-vers.com/robots.txt` |

---

## 3. Карта документів

### Backend (`backend/docs/`)

| Документ | Що описує | Коли читати |
|----------|----------|-------------|
| **`SEO_INDEX.md`** (цей файл) | Загальний довідник, архітектура | Починаєте працювати з SEO |
| **`SEO_SYSTEM_BACKEND.md`** | Middleware для ботів, JSON-LD, sitemap, robots.txt, шаблони | Змінюєте SEO-логіку Django |
| **`SEO_EXTERNAL_ANALYTICS.md`** | GSC, Bing, GA4/Meta Pixel (бекенд-перспектива), DNS, nginx, www-redirect | DevOps, налаштування серверів |
| **`COOKIE_CONSENT_BACKEND.md`** | API `/api/users/cookie-consent/`, модель Profile | Змінюєте API cookie consent |

### Frontend (`frontend/src/docs/`)

| Документ | Що описує | Коли читати |
|----------|----------|-------------|
| **`SEO_INDEX.md`** | Загальний довідник з боку фронтенду | Починаєте працювати з SEO |
| **`SEO_SYSTEM_FRONTEND.md`** | React Helmet, мета-теги, alt-атрибути | Змінюєте фронтенд-SEO |
| **`SEO_GA4_AND_TRACKING.md`** | GA4, Meta Pixel, UTM, AnalyticsProvider | Працюєте з аналітикою/трекінгом |
| **`COOKIE_CONSENT_FRONTEND.md`** | Cookie consent UI, банер, модалка | Змінюєте UI cookie consent |

---

## 4. Що де шукати (FAQ навігація)

| Питання | Документ |
|---------|----------|
| Як працює middleware для ботів? | `SEO_SYSTEM_BACKEND.md` |
| Як додати JSON-LD для нового типу сторінки? | `SEO_SYSTEM_BACKEND.md` |
| Як додати нового бота в список розпізнаних? | `SEO_SYSTEM_BACKEND.md` + nginx конфіг |
| Де налаштовується sitemap? | `SEO_SYSTEM_BACKEND.md` |
| Як перевірити індексацію в Google/Bing? | `SEO_EXTERNAL_ANALYTICS.md` → секції 3, 4 |
| Як працює www→non-www редирект? | `SEO_EXTERNAL_ANALYTICS.md` → секція 8 |
| Де зберігається верифікація Bing? | `SEO_EXTERNAL_ANALYTICS.md` → секція 4.2 |
| Як працює cookie consent API? | `COOKIE_CONSENT_BACKEND.md` |
| Як працює GA4 на фронтенді? | `frontend/src/docs/SEO_GA4_AND_TRACKING.md` |
| Як працює Meta Pixel? | `frontend/src/docs/SEO_GA4_AND_TRACKING.md` → секція 10 |
| Як додати кастомну подію трекінгу? | `frontend/src/docs/SEO_GA4_AND_TRACKING.md` → секції 7, 10.3 |

---

## 5. Файли коду (бекенд)

### SEO-додаток

```
backend/apps/seo/
├── apps.py                  # SeoConfig
├── constants.py             # SEO-константи (фрази, суфікси)
├── middleware.py             # SeoPrerendererMiddleware — визначає ботів
├── utils.py                 # Контекст-білдери, JSON-LD серіалізатори
├── views.py                 # robots_txt(), BookSitemap, StaticSitemap
├── urls.py                  # /sitemap.xml, /robots.txt
├── templates/seo/
│   ├── base_seo.html        # Базовий HTML-шаблон для ботів
│   ├── book_detail.html     # Шаблон книги з OG, JSON-LD
│   ├── home.html            # Головна сторінка для ботів
│   └── catalog.html         # Каталог для ботів
└── nginx_seo.conf.example   # Приклад nginx конфігурації
```

### Cookie consent

```
backend/apps/users/
├── models.py                # Profile.cookie_consent (JSONField)
└── api/
    ├── views.py             # CookieConsentView (GET/PUT)
    └── urls.py              # /api/users/cookie-consent/
```

### Nginx

```
/etc/nginx/
├── sites-available/fan-vers.com          # Основний конфіг + www-redirect
└── snippets/fanvers_front.current.conf   # Бот-роутинг логіка
```

---

## 6. DNS записи (Cloudflare)

| Тип | Ім'я | Значення | Призначення |
|-----|------|----------|-------------|
| A | `fan-vers.com` | IP сервера | Основний домен |
| CNAME | `www` | `fan-vers.com` | www-версія (редиректиться на non-www) |
| TXT | `fan-vers.com` | Google verification | Google Search Console |
| CNAME | `242df44e551d4873c504c8cb4a7fee5e` | `verify.bing.com` | Bing Webmaster Tools |

---

## 7. Зведений чеклист

### Інфраструктура ✅

- [x] Sitemap.xml динамічний (`/sitemap.xml`)
- [x] Robots.txt (`/robots.txt`)
- [x] Middleware для ботів (SeoPrerendererMiddleware)
- [x] JSON-LD Book schema
- [x] OG-теги для соцмереж
- [x] www → non-www 301 redirect (nginx)
- [x] SSL сертифікат (Let's Encrypt)
- [x] Cookie consent API

### Зовнішні сервіси ✅

- [x] Google Search Console — верифікований, sitemap відправлений
- [x] Bing Webmaster Tools — верифікований через CNAME
- [x] GA4 — підключений на фронтенді
- [x] Meta Pixel — підключений на фронтенді

### Залишилось зробити 📋

| Задача | Де реалізовувати |
|--------|-----------------|
| Створити `llms.txt` | Django views + nginx |
| Додати Chapter JSON-LD schema | `apps/seo/views.py` |
| Додати ChapterSitemap | `apps/seo/views.py` |
| OG image автогенерація (Pillow) | Бекенд, новий management command |
| Додати більше ботів в robots.txt | `apps/seo/views.py` |

---

## 8. Корисні команди

```bash
# Перевірити sitemap
curl https://fan-vers.com/sitemap.xml

# Перевірити robots.txt
curl https://fan-vers.com/robots.txt

# Перевірити що бот отримує HTML (а не SPA)
curl -H "User-Agent: Googlebot" https://fan-vers.com/books/solo-leveling/

# Перевірити www-redirect
curl -I https://www.fan-vers.com/
# Повинен повертати 301 → https://fan-vers.com/

# Перевірити OG-теги
curl -H "User-Agent: facebookexternalhit" https://fan-vers.com/books/solo-leveling/

# Перевірити nginx конфіг
sudo nginx -t

# Логи Django (для діагностики 5xx)
journalctl -u daphne-fanvers --since "1 hour ago"
```

---

Останнє оновлення: 2026-05-27
