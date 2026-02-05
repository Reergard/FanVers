# Дизайн і дані сторінки книги (Frontend)

Документ описує, **як саме і звідки** беруться дані для відображення сторінки книги: які файли залучені, яка схема передачі даних і що саме рендерить кожен блок. Логіку завантаження (API, React Query) див. у [BOOK_PAGE_DATA_FLOW.md](./BOOK_PAGE_DATA_FLOW.md).

---

## Схема

```
BookDetailRouter (book, volumes, chapters з React Query)
       │
       ├── useAuth() → isAuthenticated, userId, authReady (див. AUTHENTICATION_FRONTEND.md)
       ├── bookQ.isLoading або !authReady → BookDetailSkeleton
       ├── mode = owner | reader (тільки коли authReady)
       │
       ▼
BookDetailOwner | BookDetailReader
       │
       ├── Формують metaRows, description, props для секцій
       ├── Використовують book.* (поля з API після normalizeBook), chapters, volumes
       │
       ▼
BookDetailLayout(hero, description, authorWorks, chapters, comments)
       │
       ├── hero      → BookHero(title, titleSecondary, metaRows, coverImageUrl, showAgeBadge, authorMarkText, …)
       ├── description → BookDescription(description)
       ├── authorWorks → AuthorWorks(children)
       ├── chapters  → BookChapters(chapters, isOwner, loading?, callbacks)
       └── comments  → BookComments(comments, onSubmit, …)
              │
              ▼
       styles/BookDetail.module.css (верстка, токени, адаптив)
```

**Коротко:** Router віддає дані в Owner/Reader; Owner і Reader готують пропси для секцій і передають їх у Layout; Layout лише розташовує блоки; дані для кожного блоку приходять з `book`, `chapters`, `volumes` та `useAuth()`.

---

## Файли і ролі

| Файл | Назначення |
|------|------------|
| `catalog/BookDetailRouter.tsx` | Точка входу: при завантаженні book або !authReady показує `BookDetailSkeleton`; завантажує book, volumes, chapters (React Query); визначає mode (owner/reader) тільки коли authReady; рендерить `BookDetailOwner` або `BookDetailReader` з пропсами `book`, `volumes`, `chapters`, `chaptersLoading`, `volumesLoading`. |
| `catalog/BookDetailSkeleton.tsx` | Skeleton сторінки книги: той самий `BookDetailLayout` з placeholder-блоками; використовується як Suspense fallback і при завантаженні book/auth. |
| `catalog/BookDetailOwner.tsx` | Режим власника: отримує `book`, `volumes`, `chapters`, `chaptersLoading`, `volumesLoading`; обчислює `metaRows` з полів book + chapters; передає в `BookDetailLayout` hero, description, authorWorks, chapters, comments. Router вже вибрав owner — повторної перевірки немає. |
| `catalog/BookDetailReader.tsx` | Режим читача: отримує `book`, `volumes`, `chapters`, `chaptersLoading`, `volumesLoading`; аналогічно формує `metaRows` і пропси для Layout; не показує кнопки власника (isOwner=false). `useAuth()` тільки для `isAuthenticated` (кнопка «Стати перекладачем»). |
| `catalog/BookDetailLayout.tsx` | Каркас сторінки: приймає `hero`, `description`, `authorWorks`, `chapters`, `comments` як `React.ReactNode`; рендерить `<article>` з hero (full-width) і `<section class="content">` з рештою блоків. Не знає про API — тільки про розмітку. |
| `catalog/sections/BookHero.tsx` | Hero-блок: title bar (UA назва над обкладинкою + EN назва справа зі слешем /), сітка 3 колонки — обкладинка + кнопки, мета-таблиця (характеристики), права колонка (подякувати автору, 2 рейтинги, «Авторська книга», кнопка «Стати новим перекладачем»). Дані: пропси з Owner/Reader (title, titleSecondary, metaRows, coverImageUrl, showAgeBadge, authorMarkText, ratingValue тощо). |
| `catalog/sections/BookMeta.tsx` | Таблиця мета-інформації: рядки `{ label, value }`. Дані: масив `metaRows`, який Owner/Reader збирають з `book` (author, creator_username, genres, tags, fandoms, country, translation_status_display, original_status_display, chapters_count) і chapters.length. |
| `catalog/sections/BookActions.tsx` | Дві кнопки під обкладинкою: «В закладки», «Налаштування перекладу». Дані: колбеки `onBookmark`, `onTranslationSettings` з Owner/Reader. |
| `catalog/sections/BookDescription.tsx` | Секція «Опис книги»: заголовок + абзаци. Дані: `description` — рядок з пропсів; Owner/Reader беруть з `book.description` (API: GET /books/info/:slug/ повертає description). |
| `catalog/sections/AuthorWorks.tsx` | Секція «Інші роботи автора»: заголовок + контент (children). Дані: зараз порожній блок; майбутнє — список книг автора з окремого API або пропсів. |
| `catalog/sections/BookChapters.tsx` | Секція «Розділи»: заголовок, кнопки (для owner), таблиця глав. Дані: `chapters` з пропсів; `isOwner` з Router; `loading` — skeleton-рядки при завантаженні chapters; ціна/дата — колбеки або майбутні поля Chapter. |
| `catalog/sections/BookComments.tsx` | Секція «Коментарі»: форма + список коментарів. Дані: масив `comments` і колбеки `onSubmit`, `onReply`, `onDelete`; зараз comments порожній, джерело — майбутній API або локальний state. |
| `catalog/styles/BookDetail.module.css` | Стилі сторінки книги: токени (--book-accent, --book-age-bg, …), сітка hero, мета-рядки, таблиця глав, форма коментарів, адаптив. Не містить логіки даних. |

---

## Звідки беруться дані по блоках

### Hero (обкладинка, назва, мета, рейтинг, CTA)

| Елемент | Джерело |
|--------|---------|
| `title` | `book.title` (API: GET /api/catalog/books/info/:slug/) |
| `titleSecondary` | `book.titleSecondary` (API: title_en), відображається справа під UA зі слешем / |
| `coverImageUrl` | `book.image` (API: image — URL обкладинки) |
| 18+ | `showAgeBadge` ← `book.adult_content` (API: adult_content) |
| «Авторська книга» | `authorMarkText` ← тільки якщо `book.book_type === "AUTHOR"` (API: book_type) |
| `metaRows` | Формуються в Owner/Reader з `book`: author, creator_username, genres (масив → рядок через кому), tags, fandoms, country.name, translation_status_display, original_status_display, chapters_count / chapters.length; при відсутності — «—» |
| Рейтинг, «подякувати автору» | `book.ratingValue`, `book.ratingCount`, `book.thankAuthorCoins` (опційні, майбутнє API) або заглушки |
| Кнопки «В закладки», «Налаштування перекладу» | Колбеки з Owner/Reader (поки заглушки) |
| Кнопка «Стати новим перекладачем» | Колбек `onBecomeTranslator`; у Reader показується тільки при `isAuthenticated` (useAuth) |

### Опис книги

| Елемент | Джерело |
|--------|---------|
| Текст опису | `book.description` (API: GET /books/info/:slug/ повертає description). Нормалізація в catalogApi.normalizeBook(); якщо null або порожній — секція не рендериться. |

### Інші роботи автора

| Елемент | Джерело |
|--------|---------|
| Контент (картки книг) | Зараз порожній; майбутнє — окремий API (наприклад, книги того ж owner) або пропси з Router/Owner/Reader |

### Розділи

| Елемент | Джерело |
|--------|---------|
| Список глав | `chapters` з пропсів Router → Owner/Reader (API: GET /api/catalog/books/:slug/chapters/) |
| Назва, position | `chapter.title`, `chapter.position` (тип Chapter з catalogApi) |
| Вартість, дата | Колбеки `getChapterPrice(chapter)`, `getChapterDate(chapter)`; зараз заглушки («10 ₴», «13.02.2023»), далі — поля Chapter або окремий API |
| Кнопки «Додати розділ», «Створити том», «Змінити порядок» | Тільки при `isOwner`; колбеки з Owner (createVolume, enterReorderMode тощо) |
| «Читати», «Редагувати», «Видалити» | Колбеки з Owner/Reader; дані про главу — з `chapters` |

### Коментарі

| Елемент | Джерело |
|--------|---------|
| Список коментарів | Проп `comments` (масив); зараз порожній; майбутнє — API коментарів по book |
| Відправка коментаря | Колбек `onSubmit(text)`; майбутнє — POST на API + оновлення списку |

---

## Контракт даних (API + UI)

**Тип Book** (api/catalogApi.ts) — усі поля нормалізуються з відповіді GET /api/catalog/books/info/:slug/:

- Базові: `id`, `slug`, `title`, `owner`, `ownerId?`, `isPublic?`, `chapters_count?`
- З API: `description?`, `titleSecondary?` (API: title_en), `image?` (URL обкладинки), `author?`, `adult_content?`, `translation_status_display?`, `original_status_display?`, `country?` (id, name), `genres?` / `tags?` / `fandoms?` (масиви `{ id, name }`), `book_type?`, `owner_username?`, `creator_username?`
- Опційні (майбутнє API): `ratingValue?`, `ratingCount?`, `thankAuthorCoins?`

Owner/Reader передають у Hero: `coverImageUrl={book.image}`, `showAgeBadge={book.adult_content}`, `authorMarkText` лише при `book.book_type === "AUTHOR"`, `metaRows` з полів book вище.

**Chapter** (catalogApi):  
`id`, `title`, `position`, `volume?`, `volumeId?`  
Для UI можуть додатися: `price`, `created_at` / `updated_at` — тоді getChapterPrice/getChapterDate замінюються на читання з об’єкта.

**Коментарі:** окремий контракт (CommentItem у BookComments.tsx): id, authorName, authorAvatarUrl?, timeAgo, text, likes?, replies?.

---

## Порядок даних (без дублювання запитів)

1. **BookDetailRouter** один раз завантажує book, volumes, chapters через React Query (див. BOOK_PAGE_DATA_FLOW.md).
2. **Owner і Reader** не викликають getBook/getChapters/getVolumes самостійно — тільки отримують дані пропсами і формують з них `metaRows`, `description`, пропси для секцій.
3. **Layout і секції** не знають про API: вони отримують уже готові пропси (рядки, масиви, колбеки). Джерело даних для дизайну — завжди Owner/Reader.

Таким чином, дані для сторінки книги йдуть по схемі: **Backend → React Query (Router) → Owner/Reader → Layout → секції**; useAuth використовується тільки для mode (Router) і isAuthenticated (Reader); Router чекає authReady перед вибором owner/reader (див. AUTHENTICATION_FRONTEND.md).
