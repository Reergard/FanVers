# Пагінація списку розділів книги (Frontend)

Документ описує **серверну** пагінацію таблиці розділів на `/books/:slug`.  
Це **не** клієнтська кнопка «Показати ще» — див. `PAGINATION_SHOW_MORE_FRONTEND.md`.

---

## 1) Коли показується селектор діапазону

Backend (`ChapterPagination`) повертає порожній `page_ranges`, якщо розділів ≤ 50 — тоді UI завантажує всі глави без селектора.

Якщо розділів > 50 — з’являється рядок:

```text
Показано розділів:  [ 1-50 ▼ ]  з 500
```

Компонент: `navigation/ChapterRangeNavigation.tsx` (стилі: `ChapterRangeNavigation.module.css`).

- Випадаюче вікно — `FilterDropdown` (той самий механізм позиціонування, що на `/search`, але **окремі** стилі chip-кнопок у модулі глав).
- Закриття: крестик `×`, клік поза панеллю, `Escape`, вибір діапазону.

---

## 2) Потік даних

```text
BookDetailRouter
  -> useQuery book, volumes (БЕЗ chapters)
  -> BookDetailOwner | BookDetailReader
      -> BookChapters (bookId, volumes, …)
          -> useQuery getPaginatedChapters(bookId, rangeStart)
              GET /api/navigation/chapters/paginated/?book_id=&start_chapter=
          -> ChapterRangeNavigation (якщо page_ranges.length > 0)
```

**Router більше не завантажує** `GET /api/catalog/books/<slug>/chapters/` для відображення таблиці.

---

## 3) API (`api/catalogApi.ts`)

| Функція / ключ | Опис |
|----------------|------|
| `getPaginatedChapters(bookId, startChapter?)` | Запит до `API.paginatedChapters` |
| `PaginatedChaptersResponse` | `{ chapters, total_chapters, current_range, page_ranges }` |
| `catalogKeys.chaptersPage(bookId, rangeStart)` | `["book-chapters-page", bookId, rangeStart]` |
| `catalogKeys.chaptersPagesPrefix(bookId)` | `["book-chapters-page", bookId]` — інвалідація всіх сторінок |
| `invalidateBookChapterLists(qc, bookSlug, bookId)` | Скидає і `chapters(slug)`, і всі `chaptersPage` |
| `getChapters(slug)` | Повний список + `container_versions` (reorder, legacy) |

Endpoint у `api/endpoints.ts`: `paginatedChapters: "/api/navigation/chapters/paginated/"`.

---

## 4) `BookChapters.tsx`

**Файл:** `catalog/sections/BookChapters.tsx`

| Проп | Роль |
|------|------|
| `bookId` | Обов'язковий для пагінації |
| `chapters?` | Override: якщо передано — пагінація вимкнена (режим reorder) |
| `bookSlug?` | Підписка, інвалідація кешу |

Локальний state: `rangeStart` (default `1`, скидається при зміні `bookId`).

При зміні діапазону — `scrollIntoView` до секції розділів.

Після покупки розділу / застосування плану — `invalidateChaptersCache()` → `invalidateBookChapterLists`.

---

## 5) Режим власника (reorder)

`BookDetailOwner.enterReorderMode()`:

1. Завантажує **повний** список через `catalogApi.getChapters(slug)` (+ `container_versions`).
2. Передає в `BookChapters` проп `chapters={reorderChapters}` — пагінація та селектор **приховані**.
3. Після `saveOrder` / move / delete — `invalidateBookChapterLists`.

Деталі reorder: `CHAPTER_REORDER_FRONTEND.md`.

---

## 6) Інвалідація кешу (де викликається)

| Місце | Після чого |
|-------|------------|
| `BookChapters` | purchaseChapter, applyPlan |
| `BookDetailOwner` | create/delete volume, move, delete chapter, saveOrder |
| `BookDetailReader` | subscription purchase success |
| `AddChapter` | створення розділу |
| `EditChapter` | оновлення розділу |
| `ChapterDetailRouter` | покупка розділу на сторінці глави |

Завжди використовуйте `invalidateBookChapterLists(slug, bookId)`, якщо є обидва ідентифікатори.

---

## 7) Пов’язані компоненти navigation

| Компонент | Роль на сторінці книги |
|-----------|------------------------|
| `ChapterRangeNavigation` | Селектор діапазону розділів |
| `FilterDropdown` | Portal + позиціонування випадаючої панелі |
| `Breadcrumb`, `PageTitle` | Інші navigation-компоненти (не пагінація глав) |

---

## 8) Пов’язані документи

- Backend: `backend/docs/CHAPTER_PAGINATION_BACKEND.md`
- Сторінка книги: `BOOK_PAGE_DATA_FLOW.md`, `BOOK_PAGE_DESIGN_DATA_FLOW.md`
- Reorder: `CHAPTER_REORDER_FRONTEND.md`
- Підписка (чекбокси на поточній сторінці): `SUBSCRIPTION_FRONTEND.md`

**Останнє оновлення:** 2026-06-27
