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
| `catalog/ChapterDetail.tsx` | Чистый UI страницы: верхняя/нижняя навигация, контент главы, блок комментариев. |
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

- И кнопка действия (`Читати/Купити`), и клик по названию главы вызывают один и тот же `onRead(chapter)`.
- В режиме reader (`BookDetailReader`) `onRead` всегда делает `navigate("/books/{slug}/chapters/{chapterSlug}")`.
- Текст кнопки в reader меняется через `getReadLabel` (`Купити` для `is_paid && !is_purchased`), но обработчик остается тем же: переход на страницу главы.

То есть проверка доступа к платным главам фактически делегирована backend-эндпоинту chapter detail.

---

## 8) Что не реализовано на этой странице

- На странице главы нет отдельной frontend-покупки главы.
- При отказе доступа используется локальная модалка/текст ошибки, а не глобальные toast из `NotificationProvider`.

