# Данные на странице книги (Frontend)

Документ описує **завантаження даних** (API, React Query, режим owner/reader). Як саме ці дані використовуються для відображення блоків сторінки (Layout, секції, звідки береться кожен елемент UI) — див. [BOOK_PAGE_DESIGN_DATA_FLOW.md](./BOOK_PAGE_DESIGN_DATA_FLOW.md).

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
       ├── useAuth()   → isAuthenticated, userId, authReady (см. AUTHENTICATION_FRONTEND.md)
       │
       ├── bookQ.isLoading → BookDetailSkeleton (сразу дизайн, без текста)
       ├── !authReady      → BookDetailSkeleton (режим owner/reader не выбирается до bootstrap)
       │
       ├── useQuery(["book", slug])           → catalogApi.getBook(slug)           → GET /api/catalog/books/info/:slug/
       ├── useQuery(["book-volumes", slug])  → catalogApi.getVolumes(slug)        → GET /api/catalog/books/:slug/volumes/
       └── useQuery(["book-chapters", slug]) → catalogApi.getChapters(slug)       → GET /api/catalog/books/:slug/chapters/
       │
       ├── isOwner = authReady && (book.ownerId === userId)
       │
       ├── isOwner → BookDetailOwner(book, volumes, chapters, chaptersLoading, volumesLoading)
       └── !isOwner → BookDetailReader(book, volumes, chapters, chaptersLoading, volumesLoading)
```

## Файлы и роли

| Файл | Назначение |
|------|------------|
| `App.tsx` | Маршрут `/books/:slug` → `BookDetailRouter`; Suspense fallback = `BookDetailSkeleton` (сразу дизайн при lazy-load). |
| `catalog/BookDetailRouter.tsx` | Точка входа: берёт `slug` из URL; при `bookQ.isLoading` или `!authReady` показывает `BookDetailSkeleton`; через React Query загружает book, volumes, chapters; по `useAuth().userId` и `book.ownerId` определяет owner/reader только когда `authReady`; отдаёт данные в `BookDetailOwner` или `BookDetailReader`; обрабатывает 404/403 и общие ошибки. |
| `catalog/BookDetailSkeleton.tsx` | Skeleton страницы книги: тот же `BookDetailLayout` с placeholder-блоками; используется как Suspense fallback и при загрузке book/auth. |
| `catalog/BookDetailOwner.tsx` | Режим владельца: получает `book`, `volumes`, `chapters`, `chaptersLoading`, `volumesLoading` пропсами; Router уже выбрал owner — повторной проверки нет; операции: reorder глав, createVolume, saveOrder (через `catalogApi`). |
| `catalog/BookDetailReader.tsx` | Режим читателя: получает `book`, `volumes`, `chapters`, `chaptersLoading`, `volumesLoading` пропсами; `useAuth()` только для `isAuthenticated` (кнопка «Стати перекладачем»). |
| `api/catalogApi.ts` | Типы `Book`, `Chapter`, `Volume`; нормализация ответов бэкенда; объект `catalogApi`: getBook, getChapters, getVolumes, createVolume, updateChapterOrder, updateChapterOrderNoVolume; все запросы через `http` (см. USER_DATA_FLOW.md). Query keys: `catalogKeys.book(slug)`, `catalogKeys.volumes(slug)`, `catalogKeys.chapters(slug)`. |
| `api/http.ts` | Общий Axios-клиент для API: подставляет Bearer token, при 401 — refresh и retry (см. USER_DATA_FLOW.md). |
| `auth/useAuth.ts` | Хук: подписка на auth store; даёт `isAuthenticated`, `userId`, `username`, `balance`, `authReady`. На странице книги используются `isAuthenticated`, `userId`, `authReady` для выбора owner vs reader. Не вызывает `authStatus()` — данные из bootstrap. |

## Порядок загрузки

1. **Suspense** — при lazy-load `BookDetailRouter` показывается `BookDetailSkeleton` (не текст «Завантаження»).
2. **Book** — запрос сразу при наличии `slug`; пока `bookQ.isLoading` — `BookDetailSkeleton`.
3. **Auth** — Router ждёт `authReady` (bootstrap завершён); пока `!authReady` — `BookDetailSkeleton` (режим owner/reader не выбирается).
4. **Volumes и Chapters** — запросы включаются только после успешной загрузки book (`enabled: Boolean(slug) && Boolean(book)`); ключи `["book-volumes", slug]` и `["book-chapters", slug]`.
5. Режим **owner/reader** вычисляется по `book.ownerId === useAuth().userId` только когда `authReady === true`.

Данные вниз передаются только пропсами: Owner и Reader не дергают API за book/volumes/chapters сами, чтобы не дублировать запросы и не ломать кэш.

## Backend: откуда берутся данные

| Данные | Эндпоинт | Backend (apps/catalog, apps/editors) |
|--------|----------|--------------------------------------|
| Книга по slug | `GET /api/catalog/books/info/<slug>/` | `BookInfoView` (RetrieveAPIView), сериализатор: id, title, title_en, author, description, image, translation_status_display, original_status_display, country, genres, tags, fandoms, adult_content, book_type, owner_username, creator_username, view_permission, … |
| Список томов | `GET /api/catalog/books/<slug>/volumes/` | `volume_list` → `VolumeSerializer` (id, title, book) |
| Список глав | `GET /api/catalog/books/<slug>/chapters/` | `chapter_list` → `ChapterSerializer` (id, title, position, volume, …) |
| Создание тома (owner) | `POST /api/catalog/books/<slug>/create-volume/` | `create_volume` (IsAuthenticated, проверка владельца) |
| Порядок глав в томе | `POST /api/editors/volumes/<id>/update-order/` | `update_chapter_order` (chapter_orders) |
| Порядок глав глобально | `POST /api/editors/chapters/update-order/` | `update_chapter_order_no_volume` (chapter_orders с volume_id) |

Все GET-запросы идут через `http.ts`; при 401 срабатывает refresh и повтор запроса (см. USER_DATA_FLOW.md).

## Контракты данных (catalogApi)

- **Book:** id, slug, title, owner / ownerId, isPublic?, chapters_count?, description?, titleSecondary? (API: title_en), image? (URL обложки), author?, adult_content?, translation_status_display?, original_status_display?, country? (id, name), genres? / tags? / fandoms? (массивы { id, name }), book_type?, owner_username?, creator_username?, ratingValue?, ratingCount?, thankAuthorCoins?
- **Chapter:** id, title, position, volumeId? / volume?
- **Volume:** id, title, book?, position?

Ответы бэкенда нормализуются в `catalogApi.ts`: `normalizeBook()` маппит поля API (image, title_en → titleSecondary, author, genres, tags, fandoms, country, translation_status_display, original_status_display, adult_content, book_type, owner_username, creator_username) в тип `Book`. Компоненты работают только с нормализованным объектом.

## Ошибки на странице книги

- **404** (книга не найдена) — сообщение «Книгу не знайдено».
- **403** (доступ запрещён) — сообщение и ссылка «Назад» на `/`.
- Остальные ошибки — «Помилка завантаження».

Обработка только в `BookDetailRouter`; до ренера Owner/Reader страница не переходит.

## Связь с AUTHENTICATION_FRONTEND.md

Режим владельца страницы книги зависит от **userId** из `useAuth()`, который приходит из единого auth store. `authStatus()` вызывается один раз в `bootstrapAuth()` (и при login/register); `useAuth()` только подписывается на store и не делает сетевых запросов. Router ждёт `authReady` перед выбором owner/reader, чтобы избежать мигания «Немає прав».
