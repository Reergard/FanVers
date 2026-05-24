# Страница главы: данные и поведение (Frontend)

Документ фиксирует текущую реализацию страницы главы в коде фронтенда: какие файлы участвуют, какие запросы выполняются и как работают переходы.

---

## 1) Маршрут

- В `App.tsx` объявлен маршрут: `/books/:bookSlug/chapters/:chapterSlug`.
- Компонент маршрута: `catalog/ChapterDetailRouter.tsx` (lazy через `Suspense`).

---

## 2) Основные файлы

| Файл | Роль |
|---|---|
| `catalog/ChapterDetailRouter.tsx` | Точка входа страницы главы: загрузка данных, обработка ошибок, навигация между главами, модалка 403. |
| `catalog/ChapterDetail.tsx` | UI страницы + **`useReadingProgress`** (трекинг скролла/времени). |
| `catalog/hooks/useReadingProgress.ts` | POST прогресу на `/api/monitoring/chapters/{id}/progress/` — див. **READING_PROGRESS_FRONTEND.md**. |
| `api/monitoringApi.ts`, `api/monitoringKeys.ts` | Клиент мониторинга чтения. |
| `api/catalogApi.ts` | API-методы `getChapterDetail()` и `getChapterNavigation()`, нормализация ответа. |
| `catalog/sections/BookCommentsContainer.tsx` | Комментарии для главы (`type="chapter"`). |
| `shared/Modal/Modal.tsx` | Локальная модалка предупреждения при 403 в переходах Prev/Next. |

---

## 3) Какие запросы выполняются

`ChapterDetailRouter` делает два запроса через React Query (после `authReady`):

1. `catalogApi.getChapterDetail(bookSlug, chapterSlug)`  
   `GET /api/catalog/books/{bookSlug}/chapters/{chapterSlug}/`

2. `catalogApi.getChapterNavigation(bookSlug, chapterSlug)`  
   `GET /api/navigation/books/{bookSlug}/chapters/{chapterSlug}/navigation/`

Параметры query:
- `enabled`: только если есть `bookSlug`, `chapterSlug` и `authReady`.
- `staleTime`: `2 * 60_000`.
- `refetchOnWindowFocus: false`.

---

## 4) Логика рендера и ошибок

В `ChapterDetailRouter`:

- Пока `!authReady` или `chapterQ.isLoading` -> `Завантаження розділу...`
- `404` -> `Розділ не знайдено`
- `403` -> выводится текст ошибки из backend (`error`/`detail`) или дефолт.
- Любая другая ошибка (например `401`) -> `Помилка завантаження розділу`.

Важно:
- Для прямого открытия платной главы backend может вернуть `401` (гость). Сейчас это попадает в общий текст ошибки.

---

## 5) Переходы Prev/Next

UI-кнопки перехода находятся в `ChapterDetail.tsx`, но переход выполняет `ChapterDetailRouter`:

1. Пользователь нажимает Prev/Next.
2. `onNavigateToChapter(targetSlug)` в роутере сначала делает `qc.fetchQuery(...)` с `getChapterDetail(targetSlug)`.
3. Если запрос успешный -> `navigate("/books/{bookSlug}/chapters/{targetSlug}")`.
4. Если пришел `403` -> открывается локальная `Modal` с текстом ошибки (`Необхідно придбати главу для перегляду` или текст backend).

Такой prefetch не дает перейти на недоступную главу без сообщения.

---

## 6) Как считается владелец на странице главы

В `ChapterDetailRouter`:
- `isOwner = isAuthenticated && userId != null && chapter.book_owner_id === userId`.
- `isOwner` передается в `ChapterDetail`.
- `ChapterDetail` передает `isOwner` в `BookCommentsContainer` для режима комментариев владельца.

---

## 7) Связь со страницей книги

Переход на страницу главы со страницы книги идет через `BookChapters`:

- И кнопка действия (`Читати/Купити`), и клик по названию главы вызывают `handleChapterClick(chapter)`.
- В режиме reader (`BookDetailReader`):
  - если есть активный prepaid-пакет и глава платная/не куплена — при клике вызывается `purchaseChapter`, после успеха — `navigate` на страницу главы;
  - иначе — сразу `navigate` на страницу главы.
- Текст кнопки: `getReadLabel` (`Купити` для `is_paid && !is_purchased`, иначе `Читати`).

Проверка доступа к платным главам делегирована backend (chapter detail). При 403 на странице главы показывается кнопка «Купити» для покупки за баланс або prepaid.

---

## 8) Покупка на странице главы

При 403 (requires_purchase) `ChapterDetailRouter` показывает кнопку «Купити», которая вызывает `purchaseChapter(chapterId)`. Покупка выполняется за баланс або за слот prepaid-пакета (backend выбирает автоматически).

---

## 9) Мониторинг чтения

- Трекинг только для **авторизованных** (`enabled = isAuthenticated && authReady && chapterId > 0`).
- Компонент `ChapterDetail` монтируется после успешной загрузки контента (или после логина/покупки) — сессия чтения начинается с нуля.
- Условие «прочитано» на бекенде: `scroll_progress >= 90` и `reading_time >= chapter.min_reading_time` → `is_read` (нужно для комментария к главе и рейтинга книги).
- Полное описание: **READING_PROGRESS_FRONTEND.md**, бекенд — **backend/docs/READING_PROGRESS_BACKEND.md**.

