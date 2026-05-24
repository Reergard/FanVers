# SEO-система (бекенд)

Коротко: окремий Django-додаток `apps.seo` відповідає за те, щоб пошукові боти (Google, Bing, ChatGPT, Gemini тощо) бачили повноцінний HTML зі структурованими даними, а не порожній SPA (`<div id="root">`). Для звичайних користувачів нічого не змінюється — вони отримують React-додаток як і раніше.

Деталі фронтенд-частини (Helmet, alt-теги) — у **`frontend/src/docs/SEO_SYSTEM_FRONTEND.md`**.

---

## 1. Навіщо це потрібно

FanVers — це SPA (Single Page Application). Коли бот заходить на `/books/my-book/`, він бачить лише:

```html
<html><body><div id="root"></div></body></html>
```

Бот **не виконує JavaScript**, тому React-компоненти для нього не існують. Без SEO-системи сайт **невидимий** для пошуковиків та AI-систем.

SEO-система вирішує це через **middleware**, який перехоплює запити ботів і віддає їм готовий HTML з:
- `<title>` та `<meta name="description">` — для пошукової видачі
- Open Graph (`og:*`) — для прев'ю при шарингу в Telegram, Discord, Facebook
- JSON-LD (`schema.org`) — структуровані дані, які AI-пошуковики (ChatGPT, Gemini) використовують для відповідей

---

## 2. Архітектура: як працює

```
Запит від бота (User-Agent: Googlebot)
         │
         ▼
┌─────────────────────────────┐
│  SeoPrerendererMiddleware   │ ← перевіряє User-Agent
│  (apps/seo/middleware.py)   │
└──────────┬──────────────────┘
           │ Бот?
     ┌─────┴─────┐
     │ ДА        │ НІ
     ▼           ▼
 Django         Звичайний
 Template       get_response()
 (HTML з        (Django 404, або
  мета-тегами)  nginx → SPA)
```

**Для звичайних користувачів** middleware нічого не робить — запит проходить далі.

---

## 3. Файли та структура

```
backend/apps/seo/
├── __init__.py
├── apps.py                 # SeoConfig
├── constants.py            # Константні SEO-фрази (єдине джерело правди)
├── middleware.py           # Головна логіка: визначення ботів + рендеринг
├── utils.py                # Генерація контексту для шаблонів, JSON-LD
├── views.py                # sitemap.xml, robots.txt
├── urls.py                 # Маршрути: /sitemap.xml, /robots.txt
├── nginx_seo.conf.example  # Приклад nginx-конфігу для продакшену
└── templates/seo/
    ├── base_seo.html       # Базовий шаблон (lang, charset, canonical)
    ├── book_detail.html    # Сторінка книги для ботів
    ├── catalog.html        # Сторінка каталогу для ботів
    └── home.html           # Головна для ботів
```

---

## 4. Як визначається бот

**Файл:** `middleware.py`

Middleware дивиться на заголовок `User-Agent` запиту. Якщо він містить одне з ключових слів:

| Бот | Хто це |
|-----|--------|
| `googlebot` | Google Search |
| `bingbot` | Microsoft Bing (також використовується ChatGPT) |
| `gptbot`, `chatgpt-user` | OpenAI / ChatGPT |
| `google-extended` | Google Gemini |
| `anthropic-ai`, `claude-web` | Anthropic / Claude |
| `perplexitybot` | Perplexity AI |
| `facebookexternalhit` | Facebook (прев'ю посилань) |
| `twitterbot` | Twitter/X (прев'ю посилань) |
| `telegrambot` | Telegram (прев'ю посилань) |
| `linkedinbot` | LinkedIn |
| `slackbot` | Slack |
| `yandex`, `baiduspider`, `duckduckbot` | Інші пошуковики |
| `petalbot`, `semrushbot`, `ahrefsbot` | SEO-інструменти |
| `bytespider` | TikTok/ByteDance |
| `cohere-ai`, `meta-externalagent` | Cohere AI, Meta AI |

Якщо User-Agent не збігається — middleware пропускає запит далі (звичайний користувач).

---

## 5. Які сторінки обслуговуються

| URL-паттерн | Шаблон | Що віддає |
|-------------|--------|-----------|
| `/books/<slug>/` | `book_detail.html` | Мета-теги + JSON-LD для конкретної книги |
| `/catalog/` | `catalog.html` | Список публічних книг (до 50 шт) |
| `/` | `home.html` | Головна з описом сайту |

**Важливо:** Middleware віддає HTML **тільки для публічних книг** (`view_permission='all'`). Приватні книги — бот отримає fallback (не побачить їх).

---

## 6. Константні SEO-фрази

**Файл:** `constants.py`

Ключова ідея: **описання книги пишуть користувачі**, і ми не контролюємо їхній текст. Тому SEO-фрази (ключові слова для пошуку) додаються **автоматично як обгортка** навколо опису.

```
Title:       {Назва книги} — читати ранобе українською онлайн безкоштовно | FanVers
Description: Читати ранобе «{Назва}» українською мовою онлайн. {120 символів опису}... Найкраще ранобе українською. Читати онлайн безкоштовно. Кращий вибір новел на FanVers.
```

| Константа | Де використовується |
|-----------|---------------------|
| `SEO_BOOK_TITLE_SUFFIX` | `<title>` сторінки книги |
| `SEO_BOOK_DESCRIPTION_PREFIX` | Початок `<meta description>` |
| `SEO_BOOK_DESCRIPTION_SUFFIX` | Кінець `<meta description>` |
| `SEO_COVER_ALT_TEMPLATE` | Alt-тег для обкладинки |
| `SEO_KEYWORDS_BASE` | Базові ключові слова (спільні для всіх книг) |
| `SEO_SITE_NAME` | og:site_name |
| `SEO_HOME_TITLE` / `SEO_HOME_DESCRIPTION` | Головна сторінка |
| `SEO_CATALOG_TITLE` / `SEO_CATALOG_DESCRIPTION` | Сторінка каталогу |

**Якщо треба змінити SEO-фрази** — редагуй **тільки цей файл**. Зміни автоматично застосуються до всіх книг.

---

## 7. Методи моделі Book

**Файл:** `apps/catalog/models.py` (клас `Book`)

Ці методи генерують SEO-текст динамічно:

| Метод | Що робить | Приклад результату |
|-------|-----------|-------------------|
| `get_seo_title()` | Title для `<title>` | `Мій ранобе — читати ранобе українською онлайн безкоштовно \| FanVers` |
| `get_seo_meta_description()` | Повний опис для `<meta>` | `Читати ранобе «Мій ранобе» українською... {текст}... Найкраще ранобе...` |
| `get_seo_snippet(max_len)` | Обрізаний опис юзера (без HTML) | Перші 120 символів чистого тексту |
| `get_seo_keywords()` | Ключові слова | Базові + назва + жанри + теги |
| `get_genres_string()` | Жанри через кому | `Фентезі, Пригоди, Романтика` |
| `get_tags_string()` | Теги через кому | `Сильний ГГ, Система, Ісекай` |
| `get_cover_alt()` | Alt для обкладинки | `Обкладинка ранобе «Назва» — читати українською на FanVers` |

**H1 на сторінці залишається чистим** — `book.title` без ключових слів. SEO-фрази тільки в `<title>` та `<meta>`.

---

## 8. JSON-LD (структуровані дані)

**Файл:** `utils.py` → `build_book_json_ld()`

JSON-LD — це спеціальний блок у `<head>`, який пошуковики та AI читають як «картку» сайту. Виглядає так:

```json
{
  "@context": "https://schema.org",
  "@type": "Book",
  "name": "Підняття рівня в одиночку",
  "author": {"@type": "Person", "name": "Чу Конг"},
  "inLanguage": "uk",
  "genre": ["Фентезі", "Пригоди"],
  "isAccessibleForFree": true,
  "publisher": {"@type": "Organization", "name": "FanVers"},
  "url": "https://fan-vers.com/books/pidnyattya-rivnya/",
  "image": "https://fan-vers.com/media/books/cover.jpg"
}
```

**Навіщо:** коли хтось запитає ChatGPT «де почитати ранобе українською?», AI подивиться на JSON-LD з `inLanguage: "uk"` та `isAccessibleForFree: true` і може порекомендувати FanVers.

Також є `WebSite` schema з `SearchAction` — це дозволяє пошуковикам показувати пошукову строку прямо у видачі.

### Безпека JSON-LD

Оскільки title та description створюють користувачі, є ризик XSS (зловмисник може вставити `</script>` у назву книги). Функція `_json_ld_dump()` в `utils.py`:
1. Серіалізує dict через `json.dumps`
2. Замінює `</` на `<\/` (запобігає закриттю тегу `<script>`)
3. Позначає результат як `mark_safe` (щоб Django не екранував лапки в `&quot;`)

---

## 9. Sitemap та Robots

### sitemap.xml

**Файл:** `views.py` → `BookSitemap`

- Включає **всі публічні книги** (`view_permission='all'`)
- Сортує за `last_updated` (найновіші зверху)
- Вказує `lastmod` — дату останнього оновлення книги
- `changefreq: weekly`, `priority: 0.8`
- Статичні сторінки (`/`, `/catalog/`) з `priority: 1.0`

Боти перечитують sitemap регулярно (Google — щодня, GPTBot — кожні ~48 годин).

### robots.txt

**Файл:** `views.py` → `robots_txt()`

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /{admin_path}/

User-agent: GPTBot
Allow: /
...
Sitemap: https://fan-vers.com/sitemap.xml
```

**AI-боти явно дозволені** (`Allow: /`) — це сигнал, що ми хочемо бути проіндексовані.

---

## 10. Налаштування (.env)

| Змінна | За замовчуванням | Опис |
|--------|-----------------|------|
| `SEO_SITE_URL` | значення `FRONTEND_URL` | Базовий URL сайту (для canonical, og:url, sitemap) |
| `SEO_PRERENDER_ENABLED` | `true` | `false` — вимикає middleware (для dev) |

В **продакшені** обов'язково:
```env
SEO_SITE_URL=https://fan-vers.com
SEO_PRERENDER_ENABLED=true
```

---

## 11. Nginx (продакшен)

**Файл-приклад:** `nginx_seo.conf.example`

Без nginx-конфігу боти отримають `index.html` від nginx (порожній SPA) і **не дійдуть до Django middleware**.

Що робить конфіг:
1. `/sitemap.xml` і `/robots.txt` → завжди на Django
2. `/books/*`, `/catalog/`, `/` → **якщо User-Agent = бот** → Django; **інакше** → SPA (`index.html`)

**Підключення:** додати вміст файлу до `server {}` блоку ПЕРЕД стандартним `location / { try_files ... }`.

---

## 12. Реєстрація в проєкті

| Де | Що додано |
|----|-----------|
| `settings.py` → `INSTALLED_APPS` | `'django.contrib.sitemaps'`, `'apps.seo.apps.SeoConfig'` |
| `settings.py` → `MIDDLEWARE` | `'apps.seo.middleware.SeoPrerendererMiddleware'` (другий після SecurityMiddleware) |
| `urls.py` (головний) | `path('', include('apps.seo.urls'))` |
| `settings.py` → кінець файлу | `SEO_SITE_URL`, `SEO_PRERENDER_ENABLED` |

---

## 13. Чи потрібно щось робити в адмінці?

**Ні.** Система повністю автоматична:

- SEO-текст **генерується з існуючих полів** (title, description, genres, tags)
- Немає окремих полів `seo_title`, `seo_description` які треба заповнювати
- Нові книги автоматично з'являються в sitemap та отримують мета-теги
- Видалені або приватні книги автоматично зникають з sitemap

**Єдине що впливає на SEO:** якість опису книги, який пише перекладач/автор. Перші 120 символів опису потрапляють у мета-теги. Рекомендація для авторів: починати опис зі змістовного тексту, а не з привітань чи емодзі.

---

## 14. Як перевірити працездатність

### Локально (dev)

```bash
# Має повернути HTML з мета-тегами (не SPA)
curl.exe -H "User-Agent: Googlebot" http://127.0.0.1:8000/books/<slug>/

# Має повернути XML
curl.exe http://127.0.0.1:8000/sitemap.xml

# Має повернути текст
curl.exe http://127.0.0.1:8000/robots.txt
```

### На продакшені

```bash
# Перевірка через nginx
curl -H "User-Agent: Googlebot" https://fan-vers.com/books/<slug>/

# Інструменти:
# - Google Rich Results Test: https://search.google.com/test/rich-results
# - Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
# - Google Search Console: зареєструвати sitemap
# - Bing Webmaster Tools: зареєструвати sitemap (Bing = ChatGPT search)
```

---

## 15. Якщо потрібно додати нову сторінку

Наприклад, сторінки глав (`/books/<slug>/chapters/<chapter_slug>/`):

1. Додати паттерн у `SEO_ROUTES` в `middleware.py`
2. Створити шаблон `templates/seo/chapter_detail.html`
3. Додати функцію контексту в `utils.py`
4. Оновити `nginx_seo.conf.example` (додати URL-паттерн)
5. (Опціонально) Додати в `BookSitemap` або створити окремий `ChapterSitemap`

---

## 16. Потік даних (data flow)

```
1. Бот робить GET /books/solo-leveling/
2. Nginx бачить User-Agent: Googlebot → проксує на Django:8000
3. SeoPrerendererMiddleware.match → route_type = 'book', slug = 'solo-leveling'
4. Book.objects.get(slug='solo-leveling', view_permission='all')
5. book_detail_context() → генерує: seo_title, seo_meta_description, JSON-LD
6. render_to_string('seo/book_detail.html', context)
7. HttpResponse(html) → бот отримує готову сторінку
```

---

## 17. FAQ

**Q: Чи це cloaking (показуємо різний контент ботам і користувачам)?**
A: Ні. Контент ідентичний — та ж назва, той же опис, та ж обкладинка. Просто бот отримує статичний HTML, а користувач — інтерактивний React. Google офіційно рекомендує prerendering для SPA.

**Q: Чи впливає це на швидкість сайту для користувачів?**
A: Ні. Middleware додає ~1мс на перевірку User-Agent (regex match). Якщо це не бот — запит проходить далі без затримки.

**Q: Що якщо бот зайде на приватну книгу?**
A: Middleware поверне `None`, Django поверне 404. Бот не проіндексує приватний контент.

**Q: Як часто Google переіндексує?**
A: Зазвичай протягом 2-7 днів після першого сканування. `lastmod` в sitemap підказує боту які сторінки змінились.
