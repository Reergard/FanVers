# Данные страницы книги (Frontend)

Документ описывает загрузку данных для маршрута `/books/:slug`.  
Отдельная страница главы (`/books/:bookSlug/chapters/:chapterSlug`) описана в `CHAPTER_PAGE_DATA_FLOW.md`.

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
      -> useQuery chapters  (GET /api/catalog/books/:slug/chapters/)
      -> isOwner = auth + (book.ownerId ?? book.owner) === userId
      -> BookDetailOwner | BookDetailReader
```

---

## Файлы и роли

| Файл | Что делает |
|---|---|
| `catalog/BookDetailRouter.tsx` | Грузит `book/volumes/chapters`, ждет `authReady`, выбирает owner/reader, обрабатывает 404/403/other. |
| `catalog/BookDetailOwner.tsx` | Режим владельца: передает `isOwner`, owner-кнопки и `onRead` в `BookChapters`; управление порядком глав и томами. |
| `catalog/BookDetailReader.tsx` | Режим читателя: передает `onRead` и `getReadLabel` в `BookChapters`. |
| `catalog/sections/BookChapters.tsx` | Таблица глав. И клик по названию, и кнопка действия используют один `onRead(chapter)`. |
| `api/catalogApi.ts` | Типы и методы `getBook/getChapters/getVolumes`, нормализация ответов. |

---

## Переход из книги в главу

На странице книги переход в главу выполняется через `onRead`:

- в owner-режиме (`BookDetailOwner`) `onRead` всегда ведет в `/books/{slug}/chapters/{chapterSlug}`;
- в reader-режиме (`BookDetailReader`) `onRead` тоже всегда ведет в этот маршрут;
- текст кнопки для reader может быть `Купити`, но текущий handler остается переходом.

То есть доступ к платной главе окончательно проверяет backend endpoint chapter detail.

---

## Backend-источники данных для страницы книги

- `GET /api/catalog/books/info/<slug>/` -> данные книги
- `GET /api/catalog/books/<slug>/volumes/` -> тома
- `GET /api/catalog/books/<slug>/chapters/` -> главы
- `POST /api/catalog/books/<slug>/create-volume/` -> создание тома
- `POST /api/catalog/books/<slug>/add_chapter/` -> добавление главы

---

## Ошибки в `BookDetailRouter`

- `404` -> `Книгу не знайдено`
- `403` -> `Доступ заборонено`
- другое -> `Помилка завантаження`

---

## Примечание по обновлениям после создания главы

Если переход на `/books/:slug` пришел со state `chapterCreated === true`,  
`BookDetailRouter` вызывает `showSuccessAutoClose("Глава успішно завантажена")` и очищает state через `navigate(..., { replace: true })`.
