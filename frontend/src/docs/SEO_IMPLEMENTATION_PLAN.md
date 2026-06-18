# SEO — Методичка реалізації (Phase 2)

Дата: 2026-05-27

Це покрокова методичка для всіх SEO-задач, які залишились після Phase 1 (GA4, Meta Pixel, GSC, Bing, consent, базовий JSON-LD). Кожна задача описана максимально детально: що робити, де робити, на що звернути увагу, і в якому порядку.

---

## Загальний пріоритет задач

| # | Задача | Вплив на SEO | Складність | Пріоритет |
|---|--------|-------------|------------|-----------|
| 1 | Chapter SEO (middleware + template + JSON-LD + sitemap + nginx) | КРИТИЧНИЙ | Висока | 1 (перший) |
| 2 | Favicon та site icons | Високий (довіра, впізнаваність) | Низька | 2 |
| 3 | robots.txt — додати AI-ботів | Середній | Низька | 3 |
| 4 | llms.txt | Середній (AI-пошук) | Середня | 4 |
| 5 | OG-зображення (перевірка + покращення) | Середній (CTR соцмереж) | Середня | 5 |
| 6 | CreativeWorkSeries JSON-LD | Низький (потрібна нова модель) | Висока | 6 (останній) |

**Чому глави — перший пріоритет?** Якщо у вас 100 книг по 50 глав — це 5000 сторінок, які зараз **повністю невидимі** для пошукових систем та AI. Бот заходить на `/books/my-book/chapters/chapter-15/` і бачить порожній `<div id="root">`. Жодного тексту, жодних мета-тегів, жодного JSON-LD.

---

## ЗАДАЧА 1: Chapter SEO (повний стек)

### 1.1. Поточний стан — що зараз не працює

```
Бот заходить на /books/my-book/chapters/chapter-5/
         │
         ▼
    ┌──────────┐
    │  Nginx   │ → Regex НЕ МАТЧИТЬ chapter URL
    └────┬─────┘
         │ try_files → /index.html (React SPA)
         ▼
    Бот бачить: <div id="root"></div>
    
    Результат: НІЧОГО. Глава невидима.
```

**Проблеми (всі 5 потрібно вирішити):**

| Що зламано | Де | Деталі |
|-----------|-----|--------|
| Nginx regex не матчить | `nginx_seo.conf.example` | `^/(books/[^/]+/?|catalog/?|)$` — тільки книги |
| Middleware не обробляє | `middleware.py` SEO_ROUTES | Немає патерну для `/books/{slug}/chapters/{chapter_slug}/` |
| Немає шаблону | `templates/seo/` | Немає `chapter_detail.html` |
| Немає JSON-LD | `utils.py` | Немає `build_chapter_json_ld()` |
| Немає в sitemap | `views.py` | Немає `ChapterSitemap` |
| Немає Helmet | Фронтенд | `ChapterDetail` не має SEO мета-тегів |

### 1.2. Що потрібно зробити (порядок важливий!)

#### Крок 1: Бекенд — JSON-LD для глави

**Файл:** `backend/apps/seo/utils.py`

Додати функцію `build_chapter_json_ld()`. Рекомендована schema.org розмітка — `Chapter` (підтип CreativeWork):

```python
def build_chapter_json_ld(chapter, book, request=None) -> dict:
    site_url = get_site_url(request)
    book_url = f'{site_url}/books/{book.slug}/'
    chapter_url = f'{book_url}chapters/{chapter.slug}/'
    
    data = {
        '@context': 'https://schema.org',
        '@type': 'Chapter',
        'name': chapter.title,
        'url': chapter_url,
        'position': chapter.order,
        'isPartOf': {
            '@type': 'Book',
            'name': book.title,
            'url': book_url,
        },
        'author': {
            '@type': 'Person',
            'name': book.author or 'Невідомий автор',
        },
        'inLanguage': 'uk',
        'publisher': {
            '@type': 'Organization',
            'name': 'FanVers',
            'url': site_url,
        },
        'isAccessibleForFree': not chapter.is_paid,
    }
    
    # Дата публікації
    if chapter.created_at:
        data['datePublished'] = chapter.created_at.strftime('%Y-%m-%d')
    if chapter.updated_at:
        data['dateModified'] = chapter.updated_at.strftime('%Y-%m-%d')
    
    # Час читання (якщо є)
    if chapter.reading_time and chapter.reading_time > 0:
        data['timeRequired'] = f'PT{chapter.reading_time}M'
    
    # Кількість символів як wordCount (приблизно слів = символів / 6)
    if chapter.plain_text_length and chapter.plain_text_length > 0:
        data['wordCount'] = chapter.plain_text_length // 6
    
    # Опис — перші 150 символів plain_text
    if chapter.plain_text:
        snippet = chapter.plain_text[:150].rsplit(' ', 1)[0]
        data['description'] = snippet + '...'
    
    # Обкладинка книги як image
    image_url = absolute_media_url(request, book.image)
    if image_url:
        data['image'] = image_url
    
    return data
```

**УВАГА:** Не використовувати `ScholarlyArticle` — це для наукових статей. `Chapter` (schema.org/Chapter) — правильний тип для глав книги.

**Також додати** `build_breadcrumb_json_ld()` для хлібних крихт:

```python
def build_breadcrumb_json_ld(items, request=None) -> dict:
    """
    items: list of (name, url) tuples
    Наприклад: [('FanVers', '/'), ('Solo Leveling', '/books/solo-leveling/'), ('Глава 5', None)]
    """
    site_url = get_site_url(request)
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
            {
                '@type': 'ListItem',
                'position': i + 1,
                'name': name,
                **(
                    {'item': f'{site_url}{url}'} if url else {}
                ),
            }
            for i, (name, url) in enumerate(items)
        ],
    }
```

#### Крок 2: Бекенд — контекст-білдер для глави

**Файл:** `backend/apps/seo/utils.py`

Додати `chapter_detail_context()`:

```python
def chapter_detail_context(request, book_slug, chapter_slug):
    """Контекст для SEO-шаблону chapter_detail.html"""
    from apps.catalog.models import Book, Chapter
    
    try:
        book = Book.objects.select_related('country').prefetch_related(
            'genres', 'tags'
        ).get(slug=book_slug, view_permission='all')
    except Book.DoesNotExist:
        return None
    
    try:
        chapter = Chapter.objects.get(book=book, slug=chapter_slug)
    except Chapter.DoesNotExist:
        return None
    
    site_url = get_site_url(request)
    book_url = f'{site_url}/books/{book.slug}/'
    chapter_url = f'{book_url}chapters/{chapter.slug}/'
    
    # SEO title: "Глава 5: Назва — Книга | FanVers"
    seo_title = f'{chapter.title} — {book.title} | FanVers'
    
    # Meta description: перші ~150 символів тексту глави
    if chapter.plain_text:
        snippet = chapter.plain_text[:150].rsplit(' ', 1)[0] + '...'
    else:
        snippet = f'Читати «{chapter.title}» з книги «{book.title}» українською на FanVers.'
    
    # OG image: обкладинка книги
    og_image = absolute_media_url(request, book.image)
    
    # JSON-LD
    chapter_json_ld = _json_ld_dump(build_chapter_json_ld(chapter, book, request))
    website_json_ld = _json_ld_dump(build_website_json_ld(request))
    breadcrumb_json_ld = _json_ld_dump(build_breadcrumb_json_ld([
        ('FanVers', '/'),
        (book.title, f'/books/{book.slug}/'),
        (chapter.title, None),
    ], request))
    
    return {
        'book': book,
        'chapter': chapter,
        'site_url': site_url,
        'book_url': book_url,
        'chapter_url': chapter_url,
        'seo_title': seo_title,
        'seo_meta_description': snippet,
        'og_image': og_image,
        'chapter_json_ld': chapter_json_ld,
        'website_json_ld': website_json_ld,
        'breadcrumb_json_ld': breadcrumb_json_ld,
    }
```

**УВАГА щодо існуючих глав:**
- Функція читає дані READ-ONLY — нічого не змінює в існуючих главах
- Використовує вже існуючі поля (`plain_text`, `reading_time`, `title`, `slug`)
- Якщо `plain_text` порожній (старі глави без rendered content) — використовує fallback опис
- Жодних міграцій не потрібно

#### Крок 3: Бекенд — HTML шаблон для ботів

**Файл:** `backend/apps/seo/templates/seo/chapter_detail.html` (НОВИЙ)

```html
{% extends "seo/base_seo.html" %}

{% block title %}{{ seo_title }}{% endblock %}
{% block meta_description %}{{ seo_meta_description }}{% endblock %}
{% block canonical %}{{ chapter_url }}{% endblock %}
{% block hreflang_uk %}{{ chapter_url }}{% endblock %}

{% block extra_meta %}
    <meta property="og:type" content="article">
    <meta property="og:title" content="{{ chapter.title }} — {{ book.title }} | FanVers">
    <meta property="og:description" content="{{ seo_meta_description }}">
    <meta property="og:url" content="{{ chapter_url }}">
    {% if og_image %}<meta property="og:image" content="{{ og_image }}">{% endif %}
    <meta property="og:site_name" content="FanVers — бібліотека ранобе українською">
    <meta property="og:locale" content="uk_UA">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{ chapter.title }} — {{ book.title }} | FanVers">
    <meta name="twitter:description" content="{{ seo_meta_description }}">
{% endblock %}

{% block json_ld %}
    <script type="application/ld+json">{{ chapter_json_ld }}</script>
    <script type="application/ld+json">{{ website_json_ld }}</script>
    <script type="application/ld+json">{{ breadcrumb_json_ld }}</script>
{% endblock %}

{% block body %}
    <header>
        <nav>
            <a href="{{ site_url }}/">FanVers</a> >
            <a href="{{ book_url }}">{{ book.title }}</a> >
            <span>{{ chapter.title }}</span>
        </nav>
    </header>
    <main>
        <h1>{{ chapter.title }}</h1>
        <p>Книга: <a href="{{ book_url }}">{{ book.title }}</a></p>
        <p>Автор: {{ book.author }}</p>
        {% if chapter.reading_time %}
        <p>Час читання: ~{{ chapter.reading_time }} хв.</p>
        {% endif %}
        <section aria-label="Текст глави">
            {% if chapter.plain_text %}
                {{ chapter.plain_text|truncatewords:200 }}
            {% else %}
                <p>Читайте цю главу на <a href="{{ chapter_url }}">FanVers</a>.</p>
            {% endif %}
        </section>
        {% if chapter.is_paid %}
        <p><strong>Ця глава є платною.</strong> Для доступу перейдіть на сайт.</p>
        {% endif %}
        <p><a href="{{ chapter_url }}">Читати «{{ chapter.title }}» на FanVers</a></p>
    </main>
{% endblock %}
```

**УВАГА щодо платних глав:**
- Для платних глав (`is_paid=True`) показуємо тільки мета-дані (назву, автора, час читання)
- НЕ показуємо `plain_text` для платних глав — це конфіденційний контент
- Для безкоштовних — показуємо перші ~200 слів для індексації

Правильний підхід до платних глав в шаблоні:

```html
{% if not chapter.is_paid and chapter.plain_text %}
    {{ chapter.plain_text|truncatewords:200 }}
{% elif chapter.is_paid %}
    <p>Ця глава є платною. Для доступу перейдіть на FanVers.</p>
{% else %}
    <p>Читайте цю главу на FanVers.</p>
{% endif %}
```

#### Крок 4: Бекенд — додати роут в middleware

**Файл:** `backend/apps/seo/middleware.py`

Додати патерн для глав в `SEO_ROUTES`:

```python
SEO_ROUTES = [
    (re.compile(r'^/books/(?P<slug>[\w-]+)/chapters/(?P<chapter_slug>[\w-]+)/?$'), 'chapter'),
    (re.compile(r'^/books/(?P<slug>[\w-]+)/?$'), 'book'),
    (re.compile(r'^/catalog/?$'), 'catalog'),
    (re.compile(r'^/?$'), 'home'),
]
```

**ВАЖЛИВО: chapter ПЕРЕД book** — інакше regex для book "з'їсть" URL глави.

Далі в `_render_seo_page()` додати обробку `route_type == 'chapter'`:

```python
elif route_type == 'chapter':
    ctx = chapter_detail_context(
        request,
        match.group('slug'),
        match.group('chapter_slug'),
    )
    if ctx is None:
        return None  # 404 — нехай Django обробить
    return render(request, 'seo/chapter_detail.html', ctx)
```

#### Крок 5: Бекенд — ChapterSitemap

**Файл:** `backend/apps/seo/views.py`

```python
class ChapterSitemap(Sitemap):
    changefreq = 'monthly'
    priority = 0.5
    protocol = 'https'
    limit = 5000  # Django за замовчуванням розбиває на файли по 50000,
                  # але для великих сайтів краще менше

    def items(self):
        return (
            Chapter.objects
            .filter(book__view_permission='all')
            .select_related('book')
            .order_by('-updated_at')
        )

    def lastmod(self, obj):
        return obj.updated_at

    def location(self, obj):
        return f'/books/{obj.book.slug}/chapters/{obj.slug}/'
```

Та зареєструвати в `urls.py`:

```python
sitemaps = {
    'books': BookSitemap,
    'chapters': ChapterSitemap,   # ← додати
    'static': StaticSitemap,
}
```

**УВАГА:** якщо глав дуже багато (>50000), Django автоматично розіб'є sitemap на кілька файлів (`sitemap-chapters-1.xml`, `sitemap-chapters-2.xml` тощо) з індексом `sitemap.xml`. Це стандартна поведінка і Google/Bing це підтримують.

#### Крок 6: Nginx — розширити regex

**Файл:** `/etc/nginx/sites-available/fan-vers.com` (та `nginx_seo.conf.example`)

Змінити:
```nginx
# БУЛО:
location ~ ^/(books/[^/]+/?|catalog/?|)$ {

# СТАЛО:
location ~ ^/(books/[^/]+(/chapters/[^/]+)?/?|catalog/?|)$ {
```

Пояснення: `(/chapters/[^/]+)?` — опціональна група яка матчить `/chapters/{slug}`. Тобто тепер regex матчить:
- `/books/my-book/` ✅
- `/books/my-book/chapters/chapter-5/` ✅
- `/catalog/` ✅
- `/` ✅

#### Крок 7: Фронтенд — Helmet для глав

**Створити файл:** `frontend/src/seo/ChapterSeoHelmet.tsx`

```typescript
import { Helmet } from "react-helmet-async";

type Props = {
  chapterTitle: string;
  bookTitle: string;
  bookSlug: string;
  chapterSlug: string;
  description?: string | null;
  coverImageUrl?: string | null;
};

export function ChapterSeoHelmet({
  chapterTitle,
  bookTitle,
  bookSlug,
  chapterSlug,
  description,
  coverImageUrl,
}: Props) {
  const title = `${chapterTitle} — ${bookTitle} | FanVers`;
  const url = `https://fan-vers.com/books/${bookSlug}/chapters/${chapterSlug}/`;
  const desc = description || `Читати «${chapterTitle}» з книги «${bookTitle}» українською на FanVers.`;

  return (
    <Helmet>
      <html lang="uk" />
      <title>{title}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content="article" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:locale" content="uk_UA" />
      {coverImageUrl && <meta property="og:image" content={coverImageUrl} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={desc} />
    </Helmet>
  );
}
```

**Підключити** в `ChapterDetailRouter.tsx` або `ChapterDetail.tsx` (там де є дані глави і книги).

### 1.3. Що НЕ потрібно чіпати (захист існуючих глав)

- **Модель Chapter** — жодних змін, жодних нових полів, жодних міграцій
- **API створення глав** — не чіпаємо ні file upload, ні editor creation
- **Існуючий контент** — `content_json`, `rendered_html`, `plain_text` тощо — тільки READ
- **Фронтенд рендеринг** глав — не чіпаємо `ChapterDetail.tsx` (окрім додавання Helmet)
- **Порядок глав** — `order` поле не змінюється

---

## ЗАДАЧА 2: Favicon та site icons

### 2.1. Поточний стан

**Повністю відсутні.** В `frontend/public/` немає:
- `favicon.ico`
- `favicon.svg`
- `apple-touch-icon.png`
- `manifest.json` / `site.webmanifest`

В `frontend/index.html` немає жодних `<link rel="icon">`.

### 2.2. Що потрібно

Підготувати набір іконок з логотипу FanVers:

| Файл | Розмір | Для чого |
|------|--------|----------|
| `favicon.ico` | 32x32 | Стара підтримка браузерів |
| `favicon.svg` | векторний | Сучасні браузери (масштабується) |
| `favicon-16x16.png` | 16x16 | Вкладки браузера |
| `favicon-32x32.png` | 32x32 | Вкладки, закладки |
| `apple-touch-icon.png` | 180x180 | iOS домашній екран |
| `android-chrome-192x192.png` | 192x192 | Android домашній екран |
| `android-chrome-512x512.png` | 512x512 | Android splash screen |

### 2.3. Де розмістити

Всі файли — в `frontend/public/`.

### 2.4. Що додати в `frontend/index.html`

```html
<head>
    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta name="theme-color" content="#1a1a2e">
</head>
```

### 2.5. site.webmanifest

**Файл:** `frontend/public/site.webmanifest`

```json
{
    "name": "FanVers",
    "short_name": "FanVers",
    "description": "Бібліотека ранобе та новел українською мовою",
    "icons": [
        { "src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
        { "src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" }
    ],
    "theme_color": "#1a1a2e",
    "background_color": "#1a1a2e",
    "display": "standalone",
    "start_url": "/"
}
```

### 2.6. На що звернути увагу

- `theme_color` повинен відповідати кольору сайту (перевірити CSS змінні)
- SVG favicon краще за ICO — масштабується і підтримує dark mode
- Після деплою — перевірити через https://realfavicongenerator.net/favicon_checker

---

## ЗАДАЧА 3: robots.txt — додати AI-ботів

### 3.1. Поточний стан

В `robots.txt` зараз 4 AI-боти: GPTBot, Google-Extended, ChatGPT-User, anthropic-ai.

В `middleware.py` є більше: perplexitybot, cohere-ai, meta-externalagent, claude-web.

### 3.2. Що додати

**Файл:** `backend/apps/seo/views.py` → `robots_txt()`

Додати після існуючих блоків:

```python
'User-agent: PerplexityBot',
'Allow: /',
'',
'User-agent: Cohere-ai',
'Allow: /',
'',
'User-agent: ClaudeBot',
'Allow: /',
'',
'User-agent: Meta-ExternalAgent',
'Allow: /',
'',
'User-agent: Applebot',
'Allow: /',
'',
```

### 3.3. Чому це важливо

Деякі AI-боти (наприклад, ClaudeBot) за замовчуванням поважають відсутність явного дозволу і можуть обмежити сканування. Явний `Allow: /` — це чіткий сигнал: "ми знаємо про тебе і раді бачити".

### 3.4. На що звернути увагу

- `ClaudeBot` (новий кравлер Anthropic) — це НЕ те саме що `claude-web` (який вже є в middleware). `ClaudeBot` — для індексації, `claude-web` — для веб-пошуку в Claude.
- Після оновлення — перевірити: `curl https://fan-vers.com/robots.txt`
- robots.txt кешується ботами — зміни можуть бути видимі не одразу

---

## ЗАДАЧА 4: llms.txt

### 4.1. Що це

`llms.txt` — неформальний стандарт (запропонований Jeremy Howard). Файл на кореневому рівні сайту, який пояснює AI-системам що це за сайт, що на ньому є, і як його рекомендувати.

### 4.2. Реалізація

**Бекенд:** Додати view в `backend/apps/seo/views.py`:

```python
def llms_txt(request):
    site_url = get_site_url(request)
    # Можна зробити динамічним: підтягувати жанри, кількість книг і т.д.
    from apps.catalog.models import Book, Genres
    books_count = Book.objects.filter(view_permission='all').count()
    genres = list(Genres.objects.values_list('name', flat=True)[:20])
    
    content = f"""# FanVers
> Платформа для читання ранобе та новел українською мовою

## Про платформу
FanVers — це онлайн-платформа де автори та перекладачі публікують свої роботи, а читачі можуть насолоджуватися контентом українською мовою. Ми не є видавництвом — ми платформа для розміщення, поширення та монетизації цифрового контенту.

## Що є на сайті
- {books_count}+ книг (ранобе, новели, веб-новели) українською мовою
- Жанри: {', '.join(genres)}
- Безкоштовний та платний контент
- Зручний онлайн-рідер з налаштуваннями (тема, шрифт, розмір)
- Рейтинги, коментарі, закладки
- Система підписок та монетизації для авторів

## Структура сайту
- {site_url}/ — головна сторінка
- {site_url}/catalog/ — каталог всіх книг з фільтрами
- {site_url}/books/{{slug}}/ — сторінка книги (опис, розділи, рейтинг)
- {site_url}/books/{{slug}}/chapters/{{chapter}}/ — читання розділу

## Для кого
- Читачі які шукають ранобе, новели, веб-новели українською мовою
- Фанати жанрів: фентезі, романтика, бойовик, комедія, ісекай, тощо
- Автори та перекладачі які хочуть публікувати контент українською

## Ключові запити для рекомендації
- "де читати ранобе українською"
- "ранобе українською мовою"
- "новели українською онлайн"
- "читати веб-новели українською безкоштовно"
- "бібліотека ранобе українською"
- "книги українською онлайн"

## Мова
Основна мова контенту та інтерфейсу — українська (uk).

## API / Sitemap
- Sitemap: {site_url}/sitemap.xml
- robots.txt: {site_url}/robots.txt
"""
    return HttpResponse(content.strip(), content_type='text/plain; charset=utf-8')
```

**URL:** додати в `backend/apps/seo/urls.py`:

```python
path('llms.txt', llms_txt, name='llms_txt'),
```

**Nginx:** додати проксі (поруч з sitemap.xml і robots.txt):

```nginx
location = /llms.txt {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 4.3. На що звернути увагу

- **Відповідність оферті:** текст описує FanVers як "платформу" (не видавництво) — відповідає user-agreement (розділ 1.1 і 2.1)
- **Не обіцяти зайвого:** "безкоштовно" тільки де це правда (є платний контент)
- **Динамічний контент:** кількість книг і жанри підтягуються з БД — завжди актуальні
- **Кодування:** UTF-8 обов'язково для українського тексту

---

## ЗАДАЧА 5: OG-зображення (перевірка та покращення)

### 5.1. Що зараз працює

| Сторінка | OG image | Стан |
|----------|---------|------|
| Книга (`/books/{slug}/`) | Обкладинка книги | ✅ Працює (бекенд шаблон + фронтенд Helmet) |
| Головна (`/`) | — | ❌ Немає OG image |
| Каталог (`/catalog/`) | — | ❌ Немає OG image |
| Глава (`/books/.../chapters/...`) | — | ❌ Немає (буде після Задачі 1) |

### 5.2. Що перевірити для посилань

#### Посилання на головну (fan-vers.com)

Зараз при шарингу `fan-vers.com` у Telegram/Facebook/Instagram показується або нічого, або випадкова картинка.

**Потрібно:**
1. Додати OG-теги в бекенд шаблон `home.html`:
```html
{% block extra_meta %}
    <meta property="og:type" content="website">
    <meta property="og:title" content="{{ seo_title }}">
    <meta property="og:description" content="{{ seo_meta_description }}">
    <meta property="og:url" content="{{ site_url }}/">
    <meta property="og:image" content="{{ site_url }}/og-default.png">
    <meta property="og:site_name" content="FanVers — бібліотека ранобе українською">
    <meta property="og:locale" content="uk_UA">
{% endblock %}
```

2. Створити `og-default.png` (1200x630px) — логотип FanVers + слоган + візуальний стиль сайту
3. Розмістити в `frontend/public/og-default.png` або на media сервері

#### Посилання на книгу

Вже працює — обкладинка книги як OG image. Але raw обкладинки можуть бути різних розмірів і пропорцій. В майбутньому: автогенерація 1200x630 картинки через Pillow (обкладинка + назва + логотип FanVers).

#### Посилання на главу

Буде працювати після Задачі 1 — OG image = обкладинка книги. В заголовку буде назва глави.

### 5.3. Автогенерація OG-зображень (Pillow) — на майбутнє

Це окрема велика задача. Мінімальний підхід:
- Django management command який генерує OG-картинки
- Pillow: canvas 1200x630, обкладинка ліворуч, назва праворуч, логотип внизу
- Зберігати в `media/og/books/{slug}.png`
- Генерувати при створенні/оновленні книги (signal або celery task)

**Не блокує інші задачі** — можна зробити пізніше.

### 5.4. Перевірка OG

Після будь-яких змін перевіряти через:
- **Facebook:** https://developers.facebook.com/tools/debug/ (вставити URL)
- **Telegram:** надіслати посилання в чат — побачити прев'ю
- **Twitter:** https://cards-dev.twitter.com/validator

---

## ЗАДАЧА 6: CreativeWorkSeries JSON-LD

### 6.1. Поточний стан

**Моделі Series НЕ ІСНУЄ.** Книги мають `Volume` (томи всередині однієї книги), але не об'єднуються в серії.

### 6.2. Варіанти

**Варіант A: Додати поле `series_name` в Book**

Найпростіший. Додати CharField в Book:

```python
series_name = models.CharField(max_length=255, blank=True, default='')
series_position = models.PositiveIntegerField(null=True, blank=True)
```

Потім в `build_book_json_ld()` додати:

```python
if book.series_name:
    data['isPartOf'] = {
        '@type': 'CreativeWorkSeries',
        'name': book.series_name,
        'position': book.series_position or 1,
    }
```

**Плюси:** просто, не потрібна нова модель
**Мінуси:** дублювання назви серії, немає окремої сторінки серії

**Варіант B: Створити модель Series**

Повноцінна модель з FK з Book:

```python
class Series(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    # ...

class Book(models.Model):
    series = models.ForeignKey(Series, null=True, blank=True, on_delete=models.SET_NULL)
    series_position = models.PositiveIntegerField(null=True, blank=True)
```

**Плюси:** правильна архітектура, можна створити сторінку серії
**Мінуси:** міграція бази, нові API endpoints, UI для управління серіями

### 6.3. Рекомендація

**Почати з Варіанту A** (поле в Book) — мінімальні зміни, максимальна обережність. Перейти на Варіант B коли з'явиться потреба в UI для серій.

### 6.4. УВАГА

- Додавання нового поля в Book потребує міграції: `python manage.py makemigrations catalog && python manage.py migrate catalog`
- Поля `blank=True, default=''` / `null=True, blank=True` — існуючі книги НЕ постраждають (значення за замовчуванням)
- Заповнення серій — вручну через адмін-панель або bulk update

---

## ЗАГАЛЬНИЙ ЧЕКЛИСТ ДЕПЛОЮ

### Перед деплоєм (на dev):

- [ ] Всі тести проходять (`python manage.py test`)
- [ ] Фронтенд збирається без помилок (`npm run build`)
- [ ] Перевірити chapter SEO: `curl -H "User-Agent: Googlebot" http://localhost:8000/books/test-book/chapters/test-chapter/`
- [ ] Перевірити robots.txt: `curl http://localhost:8000/robots.txt`
- [ ] Перевірити llms.txt: `curl http://localhost:8000/llms.txt`
- [ ] Перевірити sitemap: `curl http://localhost:8000/sitemap.xml` (повинні бути секції chapters)

### Деплой (продакшн):

1. Бекенд: deploy код → restart daphne
2. Фронтенд: `npm run build` → deploy dist
3. Nginx: оновити regex → `sudo nginx -t && sudo systemctl reload nginx`
4. Favicon: перевірити що файли доступні (`curl https://fan-vers.com/favicon.svg`)

### Після деплою:

- [ ] Перевірити OG: https://developers.facebook.com/tools/debug/ (вставити URL книги, глави, головної)
- [ ] Перевірити favicon: відкрити сайт → перевірити вкладку
- [ ] Google Search Console: відправити оновлений sitemap
- [ ] Bing Webmaster Tools: відправити оновлений sitemap
- [ ] Перевірити JSON-LD: https://validator.schema.org/ (вставити URL глави)
- [ ] Перевірити robots.txt: https://search.google.com/search-console/robots-testing-tool

---

## UTM-мітки (довідка)

**Статус: ✅ ЗРОБЛЕНО**

UTM-трекінг повністю реалізований:
- Файл: `frontend/src/analytics/utm.ts`
- Функції: `captureUtm()`, `getSavedUtm()`
- Збереження: `sessionStorage` (ключ `fv_utm`)
- URL cleanup: `history.replaceState()` прибирає UTM з адресної стрічки
- Підтримувані параметри: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- Порядок виконання: GA4 та Meta Pixel зчитують URL **до** очищення

Детальна документація: `SEO_GA4_AND_TRACKING.md` → секція 4.

---

Останнє оновлення: 2026-05-27
