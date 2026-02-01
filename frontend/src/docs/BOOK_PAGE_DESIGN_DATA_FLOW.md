# Дизайн і дані сторінки книги (Frontend)

Документ описує, **як саме і звідки** беруться дані для відображення сторінки книги: які файли залучені, яка схема передачі даних і що саме рендерить кожен блок. Логіку завантаження (API, React Query) див. у [BOOK_PAGE_DATA_FLOW.md](./BOOK_PAGE_DATA_FLOW.md).

---

## Схема

```
BookDetailRouter (book, volumes, chapters з React Query)
       │
       ├── useAuth() → isAuthenticated, userId (див. USER_DATA_FLOW.md)
       ├── mode = owner | reader
       │
       ▼
BookDetailOwner | BookDetailReader
       │
       ├── Формують metaRows, description, props для секцій
       ├── Використовують book.* (API + розширені поля), chapters, volumes
       │
       ▼
BookDetailLayout(hero, description, authorWorks, chapters, comments)
       │
       ├── hero      → BookHero(title, metaRows, coverImageUrl, …)
       ├── description → BookDescription(description)
       ├── authorWorks → AuthorWorks(children)
       ├── chapters  → BookChapters(chapters, isOwner, callbacks)
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
| `catalog/BookDetailRouter.tsx` | Точка входу: завантажує book, volumes, chapters (React Query); визначає mode (owner/reader); рендерить `BookDetailOwner` або `BookDetailReader` з пропсами `book`, `volumes`, `chapters`. Дані з API не міняються тут — лише передаються вниз. |
| `catalog/BookDetailOwner.tsx` | Режим власника: отримує `book`, `volumes`, `chapters`; обчислює `metaRows` з полів book + chapters; передає в `BookDetailLayout` hero, description, authorWorks, chapters, comments. Джерело даних для UI — ті самі пропси + локальний state (reorderMode, saveError). |
| `catalog/BookDetailReader.tsx` | Режим читача: отримує `book`, `volumes`, `chapters`; аналогічно формує `metaRows` і пропси для Layout; не показує кнопки власника (isOwner=false). Джерело даних — тільки пропси + `useAuth()`. |
| `catalog/BookDetailLayout.tsx` | Каркас сторінки: приймає `hero`, `description`, `authorWorks`, `chapters`, `comments` як `React.ReactNode`; рендерить `<article>` з hero (full-width) і `<section class="content">` з рештою блоків. Не знає про API — тільки про розмітку. |
| `catalog/sections/BookHero.tsx` | Hero-блок: обкладинка, 18+, «Авторська книга», кнопки під обкладинкою, назва, мета-таблиця, рейтинг, «подякувати автору», кнопка «Стати новим перекладачем». Дані: пропси з Owner/Reader (title, metaRows, coverImageUrl, ratingValue тощо). |
| `catalog/sections/BookMeta.tsx` | Таблиця мета-інформації: рядки `{ label, value }`. Дані: масив `metaRows`, який Owner/Reader збирають з `book` (і при потребі з chapters). |
| `catalog/sections/BookActions.tsx` | Дві кнопки під обкладинкою: «В закладки», «Налаштування перекладу». Дані: колбеки `onBookmark`, `onTranslationSettings` з Owner/Reader. |
| `catalog/sections/BookDescription.tsx` | Секція «Опис книги»: заголовок + абзаци. Дані: `description` — рядок з пропсів; Owner/Reader беруть його з `book` (розширене поле або майбутнє API). |
| `catalog/sections/AuthorWorks.tsx` | Секція «Інші роботи автора»: заголовок + контент (children). Дані: зараз порожній блок; майбутнє — список книг автора з окремого API або пропсів. |
| `catalog/sections/BookChapters.tsx` | Секція «Розділи»: заголовок, кнопки (для owner), таблиця глав. Дані: `chapters` з пропсів; `isOwner` з useAuth + book.ownerId; ціна/дата — колбеки або майбутні поля Chapter. |
| `catalog/sections/BookComments.tsx` | Секція «Коментарі»: форма + список коментарів. Дані: масив `comments` і колбеки `onSubmit`, `onReply`, `onDelete`; зараз comments порожній, джерело — майбутній API або локальний state. |
| `catalog/styles/BookDetail.module.css` | Стилі сторінки книги: токени (--book-accent, --book-age-bg, …), сітка hero, мета-рядки, таблиця глав, форма коментарів, адаптив. Не містить логіки даних. |

---

## Звідки беруться дані по блоках

### Hero (обкладинка, назва, мета, рейтинг, CTA)

| Елемент | Джерело |
|--------|---------|
| `title` | `book.title` (API: GET /api/catalog/books/info/:slug/) |
| `titleSecondary` | Розширене поле `book` (майбутнє API або приведення типу) |
| `coverImageUrl` | Розширене поле `book` (майбутнє API) |
| 18+, «Авторська книга» | `showAgeBadge`, `authorMarkText` — розширені поля `book` або дефолти |
| `metaRows` | Формуються в Owner/Reader: лейбли + значення з `book` (chapters_count, isPublic) і заглушки «—» для автор/перекладач/жанр тощо, поки API не віддає ці поля |
| Рейтинг, «подякувати автору» | Розширені поля `book` (ratingValue, ratingCount, thankAuthorCoins) або null/заглушки |
| Кнопки «В закладки», «Налаштування перекладу» | Колбеки з Owner/Reader (поки заглушки) |
| Кнопка «Стати новим перекладачем» | Колбек `onBecomeTranslator`; у Reader показується тільки при `isAuthenticated` (useAuth) |

### Опис книги

| Елемент | Джерело |
|--------|---------|
| Текст опису | `(book as Book & { description?: string }).description` — розширене поле; зараз null, далі — API або окремий ендпоінт |

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

## Контракт даних (API + розширення для UI)

**Базовий тип Book** (api/catalogApi.ts):  
`id`, `slug`, `title`, `owner`, `ownerId?`, `isPublic?`, `chapters_count?`

**Розширені поля для дизайну** (передаються через приведення типу в Owner/Reader, поки бекенд їх не віддає):

- `description?: string` — текст опису книги  
- `titleSecondary?: string` — підзаголовок (наприклад, трансліт)  
- `coverImageUrl?: string` — URL обкладинки  
- `ageRestriction?: boolean` — показувати 18+  
- `authorMark?: string` — напис типу «Авторська книга»  
- `ratingValue?: number`, `ratingCount?: number` — рейтинг і кількість оцінок  
- `thankAuthorCoins?: number` — напис «N FanCoins», «подякувати автору»

**Chapter** (catalogApi):  
`id`, `title`, `position`, `volume?`, `volumeId?`  
Для UI можуть додатися: `price`, `created_at` / `updated_at` — тоді getChapterPrice/getChapterDate замінюються на читання з об’єкта.

**Коментарі:** окремий контракт (CommentItem у BookComments.tsx): id, authorName, authorAvatarUrl?, timeAgo, text, likes?, replies?.

---

## Порядок даних (без дублювання запитів)

1. **BookDetailRouter** один раз завантажує book, volumes, chapters через React Query (див. BOOK_PAGE_DATA_FLOW.md).
2. **Owner і Reader** не викликають getBook/getChapters/getVolumes самостійно — тільки отримують дані пропсами і формують з них `metaRows`, `description`, пропси для секцій.
3. **Layout і секції** не знають про API: вони отримують уже готові пропси (рядки, масиви, колбеки). Джерело даних для дизайну — завжди Owner/Reader.

Таким чином, дані для сторінки книги йдуть по схемі: **Backend → React Query (Router) → Owner/Reader → Layout → секції**; useAuth використовується тільки для mode і isOwner (див. USER_DATA_FLOW.md).
