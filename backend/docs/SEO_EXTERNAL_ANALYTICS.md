# Зовнішня аналітика та пошукові консолі (Backend)

Дата: 2026-05-27

Коротко: цей документ описує зовнішні сервіси аналітики та пошукові консолі, які використовуються для SEO та рекламних кампаній FanVers. Бекенд безпосередньо не завантажує GA4/Meta Pixel (це фронтенд), але забезпечує інфраструктуру: sitemap, robots.txt, JSON-LD, cookie consent API.

Пов'язана документація:
- SEO middleware, JSON-LD, sitemap: **`SEO_SYSTEM_BACKEND.md`**
- Cookie consent бекенд API: **`COOKIE_CONSENT_BACKEND.md`**
- GA4 та UTM фронтенд-інтеграція: **`frontend/src/docs/SEO_GA4_AND_TRACKING.md`**
- SEO фронтенд (Helmet, мета-теги): **`frontend/src/docs/SEO_SYSTEM_FRONTEND.md`**

---

## 1. Загальна карта зовнішніх сервісів

```
┌─────────────────────────────────────────────────────────────┐
│                    FanVers інфраструктура                    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Django     │  │   Frontend   │  │     Nginx        │  │
│  │   Backend    │  │   (React)    │  │                  │  │
│  │              │  │              │  │                  │  │
│  │ - sitemap    │  │ - GA4 скрипт │  │ - бот-роутинг   │  │
│  │ - robots.txt │  │ - UTM capture│  │ - proxy до      │  │
│  │ - JSON-LD    │  │ - Meta Pixel │  │   Django для     │  │
│  │ - consent API│  │ - consent UI │  │   ботів          │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
└─────────┼─────────────────┼────────────────────┼────────────┘
          │                 │                    │
          ▼                 ▼                    ▼
   ┌─────────────┐  ┌─────────────┐    ┌──────────────┐
   │ Google      │  │ Google      │    │ Пошукові     │
   │ Search      │  │ Analytics 4 │    │ боти         │
   │ Console     │  │ (GA4)       │    │ (Googlebot,  │
   └─────────────┘  └─────────────┘    │  GPTBot...)  │
   ┌─────────────┐  ┌─────────────┐    └──────────────┘
   │ Bing        │  │ Meta Pixel  │
   │ Webmaster   │  │ (Facebook)  │
   │ Tools       │  │             │
   └─────────────┘  └─────────────┘
```

---

## 2. Google Analytics 4 (GA4)

### 2.1. Роль бекенду

Бекенд **не завантажує** GA4 скрипт. GA4 — це JavaScript, який працює в браузері користувача. Але бекенд забезпечує:

| Що забезпечує бекенд | Навіщо для GA4 |
|----------------------|----------------|
| Cookie consent API (`/api/users/cookie-consent/`) | Синхронізує рішення про cookies між пристроями |
| Sitemap.xml (`/sitemap.xml`) | GA4 + Search Console показують дані тільки по проіндексованих сторінках |
| JSON-LD structured data | Покращує розуміння контенту пошуковиками, що впливає на якість трафіку |

### 2.2. Облікові дані

| Параметр | Значення |
|----------|----------|
| GA4 Measurement ID | `G-J9978WWKVX` |
| GA4 інтерфейс | `analytics.google.com` |
| Google акаунт | Обліковий запис власника проекту |

Measurement ID зберігається **тільки на фронтенді** (`frontend/src/analytics/ga4.ts`). Бекенду він не потрібен.

### 2.3. Що бекенд НЕ повинен робити

- Не додавати GA4 скрипт в Django-шаблони для ботів (`templates/seo/*.html`). Боти не виконують JavaScript, і GA4 їм не потрібен.
- Не зберігати GA4 ID в Django settings. Це фронтенд-конфігурація.
- Не відправляти серверні події в GA4 (Measurement Protocol) — це складно і не потрібно для поточного масштабу.

---

## 3. Google Search Console (GSC)

### 3.1. Що це

Google Search Console — панель управління для вебмайстрів. Дозволяє:
- Повідомити Google про новий сайт та його структуру (sitemap)
- Прискорити індексацію сторінок
- Бачити по яких пошукових запитах сайт з'являється
- Виявляти помилки індексації та мобільної версії
- Зв'язати з GA4 для об'єднаної аналітики

### 3.2. Верифікація

Сайт `fan-vers.com` верифікований через **DNS TXT-запис в Cloudflare**. Це означає що Google перевіряє TXT-запис в DNS зони `fan-vers.com` і підтверджує власність.

**Спосіб верифікації:** Cloudflare DNS → TXT record (значення видає Google при реєстрації)

Бекенд НЕ бере участі у верифікації. Це налаштування DNS.

### 3.3. Що бекенд забезпечує для GSC

#### Sitemap.xml

GSC регулярно перечитує `sitemap.xml` для виявлення нових та змінених сторінок.

**Файл:** `backend/apps/seo/views.py` → клас `BookSitemap`

```python
class BookSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.8

    def items(self):
        return Book.objects.filter(view_permission="all").order_by("-last_updated")

    def lastmod(self, obj):
        return obj.last_updated

    def location(self, obj):
        return f"/books/{obj.slug}/"
```

**URL:** `https://fan-vers.com/sitemap.xml`
**Маршрут Nginx:** проксується на Django (налаштовано в nginx конфігу)
**Зареєстрований в GSC:** так, через інтерфейс GSC → Sitemaps → Submit

#### Robots.txt

GSC перевіряє `robots.txt` для розуміння дозволених зон сканування.

**URL:** `https://fan-vers.com/robots.txt`
**Генерується:** `backend/apps/seo/views.py` → `robots_txt()`

#### Структуровані дані (JSON-LD)

GSC перевіряє структуровані дані і показує їх статус в розділі «Rich Results». Правильний JSON-LD = можливість отримати розширені результати в Google (зірочки рейтингу, автор, зображення).

Деталі JSON-LD — в `SEO_SYSTEM_BACKEND.md`.

### 3.4. Як перевіряти

1. Зайти на `search.google.com/search-console`
2. Обрати ресурс `fan-vers.com`
3. Розділи для моніторингу:
   - **Ефективність** — кліки, покази, позиції в пошуку
   - **Сторінки** — статус індексації (скільки проіндексовано, помилки)
   - **Файли Sitemap** — статус обробки sitemap
   - **Core Web Vitals** — швидкість та продуктивність

### 3.5. Типові проблеми та вирішення

| Проблема в GSC | Причина | Вирішення |
|---------------|---------|-----------|
| «URL не проіндексовано: виявлено, не проіндексовано» | Google знайшов URL але ще не проіндексував | Чекати (нормально для нових сайтів), або запросити індексацію вручну |
| «Помилка сервера (5xx)» | Django повернув 500 на запит бота | Перевірити логи Django/Daphne: `journalctl -u daphne-fanvers` |
| «Заблоковано файлом robots.txt» | robots.txt блокує URL | Перевірити `robots.txt` — `/api/` та `/admin/` заблоковані навмисно, інші URL повинні бути дозволені |
| «Redirect error» | Некоректний redirect (наприклад цикл) | Перевірити nginx конфіг на наявність redirect loops |
| Sitemap «Не вдалося отримати» | Nginx не проксує `/sitemap.xml` на Django | Перевірити nginx конфіг: `location = /sitemap.xml` повинен проксувати на Django |

---

## 4. Bing Webmaster Tools

### 4.1. Що це

Bing Webmaster Tools — аналог GSC для Microsoft Bing. Важливий тому що:
- Bing — пошук за замовчуванням у Windows та Edge
- **ChatGPT використовує Bing** для пошуку в реальному часі
- Індексація в Bing = видимість у ChatGPT

### 4.2. Верифікація

Bing підтримує **імпорт з Google Search Console** — найпростіший спосіб. При імпорті:
- Bing автоматично верифікує сайт (через зв'язок з GSC)
- Імпортує sitemap
- Починає індексацію

**URL:** `bing.com/webmasters`

### 4.3. Що бекенд забезпечує для Bing

Те саме що і для GSC:
- `sitemap.xml` — Bing перечитує його для індексації
- `robots.txt` — Bing перевіряє дозволи
- Коректні HTTP-відповіді для `bingbot` User-Agent (middleware)

Bing бот (`bingbot`) включений у список розпізнаних ботів у `middleware.py` та nginx конфігу.

---

## 5. Meta Pixel (Facebook/Instagram) — підготовка

### 5.1. Поточний стан

Meta Pixel **ще не підключений**. Коли буде підключений:

### 5.2. Роль бекенду

Аналогічно GA4 — бекенд **не завантажує** Meta Pixel скрипт. Але забезпечує:

| Що забезпечує бекенд | Навіщо для Meta Pixel |
|---------------------|----------------------|
| Cookie consent API | Meta вимагає GDPR compliance, інакше блокує рекламний акаунт |
| OG-теги в HTML для ботів | `facebookexternalhit` бот читає `og:image`, `og:title` для прев'ю посилань |
| Open Graph мета-теги | Facebook показує красивий прев'ю при шарингу в Messenger/Facebook |

### 5.3. OG-теги для Facebook

**Файл:** `backend/apps/seo/templates/seo/book_detail.html`

Бот `facebookexternalhit` отримує HTML з:
```html
<meta property="og:title" content="Назва книги — FanVers">
<meta property="og:description" content="Читати ранобе ...">
<meta property="og:image" content="https://fan-vers.com/media/cover.jpg">
<meta property="og:type" content="book">
<meta property="og:url" content="https://fan-vers.com/books/slug/">
<meta property="og:site_name" content="FanVers">
```

Це забезпечує красиве прев'ю при шарингу посилання на книгу в Facebook, Telegram, Discord тощо.

---

## 6. Cookie Consent API — зв'язок із зовнішньою аналітикою

### 6.1. Як це працює

```
Фронтенд (браузер)                    Бекенд (Django)
──────────────────                     ────────────────
1. Показує банер cookies
2. Користувач натискає "Прийняти"
3. Зберігає в localStorage            
4. Якщо авторизований →               5. PUT /api/users/cookie-consent/
   відправляє на бекенд                  зберігає в БД (Profile)
6. Якщо analytics=true →
   завантажує GA4 та Meta Pixel
```

### 6.2. Ендпоінт

```
GET  /api/users/cookie-consent/   → повертає поточні налаштування
PUT  /api/users/cookie-consent/   → оновлює налаштування
```

**Модель:** `apps.users.models.Profile.cookie_consent` (JSONField)

### 6.3. Чому бекенд зберігає consent

Щоб при вході з іншого пристрою (наприклад, телефону) — рішення про cookies відновилось. Якщо на ПК користувач натиснув «Прийняти» — на телефоні GA4 теж буде працювати без повторного запиту.

---

## 7. UTM-мітки — що потрібно знати бекенду

### 7.1. Що це

UTM-параметри в URL дозволяють відстежувати джерела рекламного трафіку:

```
fan-vers.com/books/slug/?utm_source=instagram&utm_medium=ad&utm_campaign=summer2026
```

### 7.2. Де обробляються

**Тільки на фронтенді** (`frontend/src/analytics/utm.ts`). Бекенд не бачить UTM-параметри тому що:
1. Nginx віддає React SPA (index.html) для звичайних користувачів
2. React завантажується і обробляє URL на клієнті
3. UTM зчитуються, зберігаються в sessionStorage, URL очищується
4. Запити до Django API не містять UTM (вони вже збережені на клієнті)

### 7.3. Чи потрібно щось робити на бекенді?

На поточному етапі — **ні**. GA4 автоматично зчитує UTM з URL.

В майбутньому можна додати серверну фіксацію UTM (наприклад, зберігати в `Profile` при реєстрації щоб знати з якої кампанії прийшов користувач). Це окрема задача.

---

## 8. Nginx — взаємодія із зовнішніми сервісами

### 8.1. Бот-роутинг (нагадування)

Nginx визначає чи запит від бота і проксує на Django:

```nginx
# В /etc/nginx/snippets/fanvers_front.current.conf:
location ~ ^/(books/[^/]+/?|catalog/?|)$ {
    set $seo_prerender 0;
    if ($http_user_agent ~* "(googlebot|bingbot|...)") {
        set $seo_prerender 1;
    }
    if ($seo_prerender = 1) {
        proxy_pass http://fanvers_daphne;
    }
    # інакше — SPA
    try_files $uri $uri/ /index.html;
}
```

Це важливо для:
- **GSC** — Googlebot отримує HTML з мета-тегами
- **Bing** — bingbot отримує HTML
- **Meta** — facebookexternalhit отримує OG-теги
- **ChatGPT** — GPTBot отримує JSON-LD

### 8.2. Content Security Policy (CSP) — увага!

Якщо в nginx налаштований CSP-заголовок — потрібно дозволити домени GA4 та Meta Pixel:

```nginx
# Приклад CSP (якщо використовується):
add_header Content-Security-Policy "
  script-src 'self' https://www.googletagmanager.com https://connect.facebook.net;
  connect-src 'self' https://www.google-analytics.com https://analytics.google.com;
  img-src 'self' data: https://www.google-analytics.com https://www.facebook.com;
";
```

**Наразі** CSP не налаштований — це не проблема, але при додаванні CSP в майбутньому — не забути ці домени.

---

## 9. Чеклист для бекенд-розробника/DevOps

### Для коректної роботи GA4:
- [ ] Sitemap.xml генерується і доступний (`curl https://fan-vers.com/sitemap.xml`)
- [ ] Robots.txt дозволяє сканування (`curl https://fan-vers.com/robots.txt`)
- [ ] Nginx проксує `/sitemap.xml` і `/robots.txt` на Django
- [ ] Cookie consent API працює (`/api/users/cookie-consent/`)
- [ ] Фронтенд зібраний з модулем analytics (`frontend/src/analytics/`)

### Для коректної роботи GSC:
- [ ] DNS верифікація пройдена (Cloudflare TXT-запис)
- [ ] Sitemap відправлений в GSC
- [ ] Nginx повертає коректні HTTP-коди для ботів (200 для існуючих, 404 для неіснуючих)
- [ ] SeoPrerendererMiddleware працює (перевірити: `curl -H "User-Agent: Googlebot" https://fan-vers.com/`)

### Для коректної роботи Bing:
- [ ] Імпортовано з GSC (або верифіковано окремо)
- [ ] `bingbot` є в списку розпізнаних ботів (middleware.py та nginx)

### Для майбутнього Meta Pixel:
- [ ] `facebookexternalhit` є в списку ботів (middleware.py та nginx) ← вже зроблено
- [ ] OG-теги генеруються в шаблонах (`og:image`, `og:title`, `og:description`)
- [ ] Cookie consent API синхронізує рішення між пристроями

---

## 10. FAQ

**Q: Чи потрібно додавати GA4 скрипт в Django шаблони для ботів?**
A: Ні. Боти не виконують JavaScript. GA4 працює тільки для реальних користувачів через фронтенд.

**Q: Чи впливає GA4 на продуктивність бекенду?**
A: Ні. GA4 — це клієнтський скрипт. Він не створює жодних запитів до Django.

**Q: Google Search Console показує помилки 5xx — що робити?**
A: Перевірити логи Django: `journalctl -u daphne-fanvers`. Типові причини: виняток в middleware, недоступність бази даних, неправильний URL-патерн.

**Q: Як часто оновлювати sitemap?**
A: Sitemap генерується динамічно при кожному запиті. Нові книги автоматично з'являються. Нічого оновлювати не потрібно.

**Q: Чи потрібен окремий GA4 для staging/dev?**
A: Рекомендується, але не обов'язково. На dev фронтенд може просто не давати згоду на cookies — GA4 не завантажиться. Для повного розділення — створити окремий GA4 ресурс і змінити ID в `ga4.ts` через env-змінну.

**Q: Що робити якщо Meta заблокував рекламний акаунт через GDPR?**
A: Перевірити що Meta Pixel завантажується ТІЛЬКИ після согласія cookies. Наша архітектура це забезпечує — `AnalyticsProvider` перевіряє `consent.analytics === true` перед завантаженням будь-яких скриптів.

---

Останнє оновлення: 2026-05-27
