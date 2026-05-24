# SEO-система (фронтенд)

Коротко: фронтенд-частина SEO відповідає за **мета-теги для живих користувачів** (react-helmet-async) та **alt-атрибути обкладинок**. Основна «важка» SEO-робота виконується на бекенді (middleware для ботів) — див. **`backend/docs/SEO_SYSTEM_BACKEND.md`**.

---

## 1. Навіщо потрібен фронтенд-SEO якщо боти отримують HTML від Django?

Дві причини:

1. **Заголовок вкладки браузера** — коли користувач відкриває книгу, вкладка показує `Назва — читати ранобе... | FanVers` замість просто `FanVers`. Це покращує UX та впізнаваність.

2. **JavaScript-боти** — деякі сучасні краулери (наприклад, Google може рендерити JS). Для них react-helmet забезпечує правильні мета-теги навіть без Django-middleware.

---

## 2. Файли

```
frontend/src/seo/
├── bookSeo.ts          # Утиліти: генерація title, description, alt, canonical URL
└── BookSeoHelmet.tsx   # React-компонент: встановлює мета-теги через Helmet
```

---

## 3. bookSeo.ts — утиліти

Цей файл — **дзеркало** бекенд-констант (`backend/apps/seo/constants.py`). Фрази мають бути однаковими.

### Функції

| Функція | Що робить | Приклад |
|---------|-----------|---------|
| `buildBookSeoTitle(title)` | Генерує `<title>` | `"Мій ранобе — читати ранобе українською онлайн безкоштовно \| FanVers"` |
| `buildBookMetaDescription(title, desc?)` | Генерує `<meta description>` | `"Читати ранобе «Назва» українською... {текст}... Найкраще ранобе..."` |
| `buildBookCanonicalUrl(slug)` | Канонічний URL | `"https://fan-vers.com/books/my-book/"` |
| `buildBookCoverAlt(title)` | Alt для обкладинки (деталі книги) | `"Обкладинка ранобе «Назва» — читати українською на FanVers"` |
| `buildBookCardCoverAlt(title)` | Alt для обкладинки (картка каталогу) | `"Обкладинка ранобе «Назва»"` |
| `cleanUserDescription(html)` | Чистить HTML-теги з опису | Прибирає `<p>`, `<b>` тощо |
| `truncateSeoSnippet(text, max)` | Обрізає текст до N символів по слову | `"Текст опису..."` |

### Константи

```typescript
SEO_BOOK_TITLE_SUFFIX = "— читати ранобе українською онлайн безкоштовно | FanVers"
```

### URL сайту

```typescript
const SITE_URL = import.meta.env.VITE_SITE_URL || "https://fan-vers.com";
```

У dev: можна задати `VITE_SITE_URL=http://localhost:5173` у `.env` файлі фронтенду. За замовчуванням — продакшен-URL.

---

## 4. BookSeoHelmet.tsx — компонент

```tsx
<BookSeoHelmet
  title={book.title}
  slug={book.slug}
  description={book.description}
  coverImageUrl={coverUrl}
/>
```

**Що встановлює в `<head>`:**
- `<html lang="uk">` — мова сторінки
- `<title>` — SEO-title з суфіксом
- `<meta name="description">` — SEO-опис
- `<link rel="canonical">` — канонічний URL
- `<meta property="og:*">` — Open Graph (для шарингу)
- `<meta name="twitter:*">` — Twitter Card

### Де підключений

**Файл:** `src/catalog/BookDetailRouter.tsx`

```tsx
// Перед BookDetailReader або BookDetailOwner:
<BookSeoHelmet
  title={book.title}
  slug={book.slug}
  description={book.description}
  coverImageUrl={coverForSeo}
/>
```

Компонент рендериться **для обох** випадків — і для власника книги, і для читача. Тобто мета-теги встановлюються незалежно від ролі.

---

## 5. Alt-теги для обкладинок

Alt-атрибути важливі для:
- Доступності (screen readers)
- SEO (Google індексує зображення)
- AI-пошуку (бот розуміє що зображено)

### Де використовується

| Компонент | Функція | Результат |
|-----------|---------|-----------|
| `BookDetailReader.tsx` | `buildBookCoverAlt(book.title)` | `"Обкладинка ранобе «Назва» — читати українською на FanVers"` |
| `BookDetailOwner.tsx` | `buildBookCoverAlt(book.title)` | Те ж саме |
| `BookCard.tsx` | `buildBookCardCoverAlt(book.title)` | `"Обкладинка ранобе «Назва»"` (коротше, бо картка) |
| `BookHero.tsx` | Приймає prop `coverImageAlt` | Значення передається з Reader/Owner |

### BookHero — як працює

```tsx
// BookHero.tsx приймає prop:
coverImageAlt?: string; // за замовчуванням "Обкладинка книги"

// В BookDetailReader передається:
<BookHero
  coverImageAlt={buildBookCoverAlt(book.title)}
  ...
/>
```

---

## 6. react-helmet-async — підключення

### main.tsx

```tsx
import { HelmetProvider } from 'react-helmet-async';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
);
```

`HelmetProvider` обгортає весь додаток. Це дозволяє будь-якому компоненту змінювати `<head>` через `<Helmet>`.

### Як працює Helmet

1. Компонент з `<Helmet>` рендериться
2. react-helmet-async оновлює `<title>`, `<meta>` тощо в реальному `<head>`
3. Коли компонент розмонтовується — теги повертаються до попередніх значень

Тобто при переході з книги назад в каталог — title зміниться назад.

---

## 7. index.html

```html
<html lang="uk">
```

**Важливо:** `lang="uk"` — сигнал для браузерів та пошуковиків що контент українською. Раніше було `lang="ru"` — це було неправильно.

---

## 8. Синхронізація з бекендом

Фронтенд і бекенд генерують **однакові** SEO-тексти. Це важливо щоб:
- Бот (отримує HTML від Django) та користувач (бачить React) мали однаковий title
- Google не вважав це cloaking (різний контент для бота і людини)

| Що | Бекенд | Фронтенд |
|----|--------|----------|
| Title суфікс | `constants.py` → `SEO_BOOK_TITLE_SUFFIX` | `bookSeo.ts` → `SEO_BOOK_TITLE_SUFFIX` |
| Description формула | `Book.get_seo_meta_description()` | `buildBookMetaDescription()` |
| Alt шаблон | `constants.py` → `SEO_COVER_ALT_TEMPLATE` | `buildBookCoverAlt()` |

**Якщо змінюєш фразу** — зміни в **обох** файлах!

---

## 9. Що НЕ робить фронтенд

- **Не генерує JSON-LD** — це тільки на бекенді (бот не виконує JS)
- **Не обслуговує sitemap/robots** — це тільки на бекенді
- **Не впливає на індексацію** напряму — основна робота на middleware

Фронтенд-SEO — це «другий шар захисту» та UX-покращення.

---

## 10. Якщо потрібно додати SEO для нової сторінки

Наприклад, для сторінки глави (`/books/:slug/chapters/:chapterSlug`):

1. Створити функції в `bookSeo.ts`:
   ```typescript
   export function buildChapterSeoTitle(bookTitle: string, chapterTitle: string): string {
     return `${chapterTitle} — ${bookTitle} | FanVers`;
   }
   ```

2. Створити компонент `ChapterSeoHelmet.tsx` (або розширити `BookSeoHelmet`)

3. Підключити в `ChapterDetail.tsx`:
   ```tsx
   <ChapterSeoHelmet ... />
   ```

4. **Не забути бекенд:** додати відповідний маршрут в middleware та шаблон.

---

## 11. Залежності

| Пакет | Версія | Навіщо |
|-------|--------|--------|
| `react-helmet-async` | ^3.0.0 | Динамічні мета-теги в SPA |

Встановлений в `package.json` → `dependencies`.

---

## 12. FAQ

**Q: Чому не react-helmet (без -async)?**
A: `react-helmet` — застарілий і не підтримує React 18+/19. `react-helmet-async` — активно підтримується, працює з Suspense та concurrent mode.

**Q: Чи потрібно додавати Helmet на кожну сторінку?**
A: Бажано для основних сторінок (каталог, профіль, пошук). Але пріоритет — сторінки книг (вони основний контент для індексації).

**Q: Що якщо забути додати BookSeoHelmet?**
A: Вкладка покаже дефолтний `<title>FanVers</title>` з index.html. Бот (через Django middleware) все одно отримає правильні мета-теги — це не критично для SEO, але поганий UX.

**Q: VITE_SITE_URL — обов'язкова?**
A: Ні. Якщо не задана — за замовчуванням `https://fan-vers.com`. Задавати потрібно тільки якщо хочете інший URL в dev (наприклад для тестування canonical).
