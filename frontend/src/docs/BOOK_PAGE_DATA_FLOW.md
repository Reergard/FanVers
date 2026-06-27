# Данные страницы книги (Frontend)

Документ описывает загрузку данных для маршрута `/books/:slug`.  
Отдельная страница главы (`/books/:bookSlug/chapters/:chapterSlug`) описана в `CHAPTER_PAGE_DATA_FLOW.md`.  
Система підписки — `SUBSCRIPTION_FRONTEND.md`.

---

## Маршруты, связанные со страницей книги

- `/books/:slug` -> `BookDetailRouter`
- `/books/:slug/add-chapter` -> `AddChapter`
- `/books/:bookSlug/chapters/:chapterSlug` -> `ChapterDetailRouter` (переход со страницы книги по `onRead`)

---

## Схема загрузки

```text
URL /books/:slug
  -> BookDetailRouter
      -> useAuth() => isAuthenticated, userId, authReady
      -> useQuery book      (GET /api/catalog/books/info/:slug/)
      -> useQuery volumes   (GET /api/catalog/books/:slug/volumes/)
      -> isOwner = auth + (book.ownerId ?? book.owner) === userId
      -> BookDetailOwner | BookDetailReader
          -> BookChapters (bookId, volumes, …)
              -> useQuery getPaginatedChapters(bookId, rangeStart)
                  GET /api/navigation/chapters/paginated/?book_id=&start_chapter=
              -> ChapterRangeNavigation (якщо page_ranges.length > 0)
```

Список розділів **не** завантажується в Router. Повний catalog-список (`GET .../chapters/`) використовується лише в режимі **reorder** власника — див. `CHAPTER_REORDER_FRONTEND.md`, `CHAPTER_PAGINATION_FRONTEND.md`.

---

## Файлы и роли

| Файл | Что делает |
|---|---|
| `catalog/BookDetailRouter.tsx` | Грузит `book` и `volumes`, ждет `authReady`, выбирает owner/reader, обрабатывает 404/403/other. |
| `catalog/BookDetailOwner.tsx` | Режим владельца: передает `bookId`, owner-кнопки и `onRead` в `BookChapters`; reorder — отдельная загрузка полного списка. |
| `catalog/BookDetailReader.tsx` | Режим читателя: передает `bookId`, `onRead`, `getReadLabel`, `SubscriptionPurchaseBlock` в layout. |
| `catalog/sections/BookExtraImages.tsx` | Додаткові зображення книги (read-only); між описом і «Інші роботи автора»; приховано без `extra_images`. |
| `catalog/sections/BookChapters.tsx` | Таблица глав (серверная пагинация через `getPaginatedChapters`). `ChapterRangeNavigation` при >50 разделах. `handleChapterClick`: при prepaid — purchaseChapter → navigate; иначе navigate. |
| `navigation/ChapterRangeNavigation.tsx` | Селектор диапазона «Показано розділів: 1-50 з N». |
| `catalog/sections/SubscriptionPurchaseBlock.tsx` | Блок абонименту: prepaid-плани, активний пакет, підказка. |
| `api/catalogApi.ts` | Типы и методы `getBook/getChapters/getPaginatedChapters/getVolumes`, `invalidateBookChapterLists`, нормализация ответов. |

---

## Переход из книги в главу

На странице книги переход в главу выполняется через `onRead` (фактически через `handleChapterClick` в `BookChapters`):

- в owner-режиме (`BookDetailOwner`) — всегда переход в `/books/{slug}/chapters/{chapterSlug}`;
- в reader-режиме (`BookDetailReader`):
  - если у пользователя есть активный prepaid-пакет (remaining > 0) и глава платная/не куплена — при клике «Купити» сначала вызывается `purchaseChapter`, после успеха — переход на страницу главы;
  - иначе — переход на страницу главы (доступ проверяет backend; при 403 показывается кнопка «Купити» на странице главы).

Текст кнопки: `Купити` для `is_paid && !is_purchased`, иначе `Читати`.

---

## Розкладка сторінки (`BookDetailLayout`)

Порядок секцій у `content`:

1. Опис (`description`)
2. Додаткові зображення (`extraImages`) — лише якщо `BookExtraImages` має дані
3. Інші роботи автора (`authorWorks`)
4. Підписка (`subscription`, reader)
5. Розділи (`chapters`)
6. Коментарі (`comments`)

---

- `GET /api/catalog/books/info/<slug>/` -> данные книги (включая `extra_images` — додаткові зображення)
- `GET /api/catalog/books/<slug>/volumes/` -> тома
- `GET /api/navigation/chapters/paginated/?book_id=&start_chapter=` -> страница списка глав для UI таблицы (см. `CHAPTER_PAGINATION_FRONTEND.md`)
- `GET /api/catalog/books/<slug>/chapters/` -> полный список + `container_versions` (reorder, не для обычного просмотра)
- `POST /api/catalog/books/<slug>/create-volume/` -> создание тома
- `POST /api/catalog/books/<slug>/add_chapter/` -> добавление главы
- `POST /api/catalog/books/<slug>/chapters/reorder/` -> изменение порядка глав (см. CHAPTER_REORDER_FRONTEND.md)
- `POST /api/catalog/books/<slug>/chapters/<id>/move/` -> перемещение главы между томами
- `GET /api/subscription/books/<slug>/` -> налаштування підписки, плани, активний пакет
- `POST /api/users/purchase-chapter/<id>/` -> покупка глави (баланс або prepaid)

---

## Ошибки в `BookDetailRouter`

- `404` -> `Книгу не знайдено`
- `403` -> `Доступ заборонено`
- другое -> `Помилка завантаження`

---

## Примечание по обновлениям после создания главы

Если переход на `/books/:slug` пришел со state `chapterCreated === true`,  
`BookDetailRouter` вызывает `showSuccessAutoClose("Розділ успішно створено")` и очищает state через `navigate(..., { replace: true })`.
