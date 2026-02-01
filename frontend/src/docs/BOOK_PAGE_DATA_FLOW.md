# Данные на странице книги (Frontend)

## Маршрут

- **URL:** `/books/:slug`
- **Компонент:** `BookDetailRouter` (catalog/BookDetailRouter.tsx)
- **Подключение:** `App.tsx` — `<Route path="/books/:slug" element={<BookDetailRouter />} />`

## Схема загрузки данных

```
URL (/books/:slug)
       │
       ▼
BookDetailRouter
       │
       ├── useParams() → slug
       ├── useAuth()   → isAuthenticated, userId (см. USER_DATA_FLOW.md)
       │
       ├── useQuery(["book", slug])           → catalogApi.getBook(slug)           → GET /api/catalog/books/info/:slug/
       ├── useQuery(["book-volumes", slug])  → catalogApi.getVolumes(slug)        → GET /api/catalog/books/:slug/volumes/
       └── useQuery(["book-chapters", slug]) → catalogApi.getChapters(slug)       → GET /api/catalog/books/:slug/chapters/
       │
       ├── mode = (book.ownerId === userId) ? "owner" : "reader"
       │
       ├── mode === "owner" → BookDetailOwner(book, volumes, chapters)
       └── mode === "reader" → BookDetailReader(book, volumes, chapters)
```

## Файлы и роли

| Файл | Назначение |
|------|------------|
| `App.tsx` | Маршрут `/books/:slug` → `BookDetailRouter`; оборачивает приложение в `QueryClientProvider` (React Query). |
| `catalog/BookDetailRouter.tsx` | Точка входа: берёт `slug` из URL; через React Query загружает book, затем volumes и chapters; по `useAuth().userId` и `book.ownerId` определяет режим (owner/reader); отдаёт данные в `BookDetailOwner` или `BookDetailReader`; обрабатывает 404/403 и общие ошибки. |
| `catalog/BookDetailOwner.tsx` | Режим владельца: получает `book`, `volumes`, `chapters` пропсами; повторно проверяет `isOwner`; операции: reorder глав, createVolume, saveOrder (через `catalogApi`). После createVolume инвалидирует только `["book-volumes", slug]`; после saveOrder — только `["book-chapters", slug]`. |
| `catalog/BookDetailReader.tsx` | Режим читателя: получает `book`, `volumes`, `chapters` пропсами; отображает данные; не определяет авторизацию сам — только через `useAuth()`. |
| `api/catalogApi.ts` | Типы `Book`, `Chapter`, `Volume`; нормализация ответов бэкенда; объект `catalogApi`: getBook, getChapters, getVolumes, createVolume, updateChapterOrder, updateChapterOrderNoVolume; все запросы через `http` (см. USER_DATA_FLOW.md). Query keys: `catalogKeys.book(slug)`, `catalogKeys.volumes(slug)`, `catalogKeys.chapters(slug)`. |
| `api/http.ts` | Общий Axios-клиент для API: подставляет Bearer token, при 401 — refresh и retry (см. USER_DATA_FLOW.md). |
| `auth/useAuth.ts` | Хук: даёт `isAuthenticated`, `userId`, `username`, `balance`. На странице книги используются `isAuthenticated` и `userId` для выбора owner vs reader. |

## Порядок загрузки

1. **Book** — запрос сразу при наличии `slug`; ключ кэша `["book", slug]`; staleTime 2 мин.
2. **Volumes и Chapters** — запросы включаются только после успешной загрузки book (`enabled: Boolean(slug) && Boolean(book)`); ключи `["book-volumes", slug]` и `["book-chapters", slug]`.
3. Режим **owner/reader** вычисляется по `book.ownerId === useAuth().userId` (при авторизованном пользователе).

Данные вниз передаются только пропсами: Owner и Reader не дергают API за book/volumes/chapters сами, чтобы не дублировать запросы и не ломать кэш.

## Backend: откуда берутся данные

| Данные | Эндпоинт | Backend (apps/catalog, apps/editors) |
|--------|----------|--------------------------------------|
| Книга по slug | `GET /api/catalog/books/info/<slug>/` | `BookInfoView` (RetrieveAPIView), сериализатор с полями id, title, slug, owner, … |
| Список томов | `GET /api/catalog/books/<slug>/volumes/` | `volume_list` → `VolumeSerializer` (id, title, book) |
| Список глав | `GET /api/catalog/books/<slug>/chapters/` | `chapter_list` → `ChapterSerializer` (id, title, position, volume, …) |
| Создание тома (owner) | `POST /api/catalog/books/<slug>/create-volume/` | `create_volume` (IsAuthenticated, проверка владельца) |
| Порядок глав в томе | `POST /api/editors/volumes/<id>/update-order/` | `update_chapter_order` (chapter_orders) |
| Порядок глав глобально | `POST /api/editors/chapters/update-order/` | `update_chapter_order_no_volume` (chapter_orders с volume_id) |

Все GET-запросы идут через `http.ts`; при 401 срабатывает refresh и повтор запроса (см. USER_DATA_FLOW.md).

## Контракты данных (catalogApi)

- **Book:** id, slug, title, owner / ownerId, isPublic?, chapters_count?
- **Chapter:** id, title, position, volumeId? / volume?
- **Volume:** id, title, book?, position?

Ответы бэкенда нормализуются в `catalogApi.ts` (например, `owner` → `ownerId`), чтобы компоненты работали с единым форматом.

## Ошибки на странице книги

- **404** (книга не найдена) — сообщение «Книгу не знайдено».
- **403** (доступ запрещён) — сообщение и ссылка «Назад» на `/`.
- Остальные ошибки — «Помилка завантаження».

Обработка только в `BookDetailRouter`; до ренера Owner/Reader страница не переходит.

## Связь с USER_DATA_FLOW.md

Режим владельца страницы книги зависит от **userId** из `useAuth()`, который приходит из того же потока: Backend AuthStatusView → authStatus() → useAuth(). Без корректного `userId` в ответе auth-status определение owner/reader невозможно. См. USER_DATA_FLOW.md.
