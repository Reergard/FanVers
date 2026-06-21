# Покинуті переклади — Frontend

Документ описує **фактичну** реалізацію сторінки `Покинуті переклади` у поточному коді фронтенду.

---

## 1) Де знаходиться сторінка

- Компонент сторінки: `frontend/src/catalog/AbandonedTranslations.tsx`
- Стилі сторінки: `frontend/src/catalog/AbandonedTranslations.css`
- Роут у застосунку: `frontend/src/App.tsx` -> `path="/abandoned"`
- Посилання в хедері: `frontend/src/widgets/header/Header.tsx` -> `to: "/abandoned"`

---

## 2) Які файли задіяні у даних

- API-метод: `frontend/src/api/catalogApi.ts` -> `getAbandonedTranslations()`
- Query key: `catalogKeys.abandonedTranslations()`
- HTTP-клієнт: `frontend/src/api/http.ts` (Bearer + 401 refresh/retry за загальною auth-схемою)

Запит зі сторінки:

- `GET /api/catalog/abandoned-translations/`

Як на бекенді формується статус `ABANDONED`, пороги часу та Celery — див. `backend/docs/ABANDONED_TRANSLATIONS_BACKEND.md`.

---

## 3) Що відбувається при відкритті сторінки

1. Компонент монтується.
2. `useQuery` викликає `getAbandonedTranslations()`.
3. До відповіді рендериться стан завантаження.
4. Якщо помилка запиту -> рендериться стан помилки.
5. Якщо список порожній -> рендериться empty-state.
6. Якщо книги є -> рендериться сітка карток.

---

## 4) Стани рендеру

У `AbandonedTranslations.tsx` є три окремі стани:

- `abandonedQuery.isLoading` -> `Завантаження покинутих перекладів…`
- `abandonedQuery.isError` -> `Не вдалося завантажити список покинутих перекладів.`
- `visibleBooks.length === 0` -> `На даний момент немає покинутих перекладів.`

---

## 5) Логіка списку (фільтрація, сортування, пагінація)

### Пошук

- Поле пошуку кероване (`searchQuery` у state).
- Фільтрація виконується по `book.title` (регістр ігнорується).
- Кнопка-іконка пошуку поруч із інпутом зараз **без окремого submit-handler** (впливає саме введення в інпут).

### Сортування

`sortBy` має варіанти:

- `created` -> сортування за `created_at` (новіші зверху)
- `updated` -> сортування за `last_updated` (новіші зверху)
- `views` та `income` -> зараз fallback-сортування за назвою (бо в endpoint немає полів для реального сортування за переглядами/доходом)
- `choose` -> порядок як прийшов з API

### Чекбокси

Стан чекбоксів зберігається у `checkValues`.

Реально впливають на список:

- `age18` -> залишає тільки книги з `adult_content === true`
- `noFandoms` -> залишає книги без фендомів (`fandoms.length === 0`)
- `ready100` -> залишає книги зі статусом оригіналу `Завершено` / `Завершений` (через `original_status_display`)
- `originalOnly` -> залишає книги типу `AUTHOR`

Поки що UI-only (даних недостатньо для коректної реалізації):

- `viewedOnly`
- `hideBookmarks`

### Пагінація

- Крок: `PAGE_SIZE = 1` (поточний тестовий режим).
- Початково показується 1 картка.
- Кнопка рендериться через `ShowMoreNavigation` (`frontend/src/navigation/ShowMoreNavigation.tsx`).
- Клік по `Показати ще` додає ще 1 картку.
- При зміні пошуку/сортування/чекбоксів лічильник повертається до `PAGE_SIZE`.

---

## 6) Як формується картка на сторінці

На сторінці використовується `BookCard`:

- `frontend/src/BookCard/BookCard.tsx`
- `frontend/src/BookCard/BookCard.css`

Особливість саме сторінки покинутих перекладів:

- `BookCard` обгортається в `abandoned-card-surface` (фон/тінь/скруглення зі стилів сторінки).
- Усередині surface додатково рендериться блок:
  - `Статус: ...`
  - `Фендом:`
  - `Теги:`
  - `Жанри:`
  - кнопка `Читати` (`ActionButton`)

Для уникнення дублювання метаданих з `BookCard`, у CSS сторінки приховано:

- `.book-card-meta-block` (тільки в контексті `.abandoned-card-surface`)

---

## 7) Що роблять кнопки у правому сайдбарі

- Кнопки списку `Жанри / Фендоми / Теги / ...` зараз декоративні (клік не відкриває додатковий контент).
- Чекбокси зроблені через `Icon` (`content_checkbox` / `content_checkbox_checked`) за тим самим принципом, що `Контент 18+` на сторінці створення книги.
- Кнопка `Пошук` у блоці чекбоксів зараз без submit-handler (фільтри застосовуються одразу при зміні state).

---

## 8) Навігація користувача

- Заголовок сторінки — `PageTitle` («Покинуті переклади»); окремого breadcrumb у поточному `AbandonedTranslations.tsx` немає (класи breadcrumb у CSS залишені для можливого повторного використання).
- Кнопка `Читати` на картці веде на `/books/:slug` (через `ActionButton` + `to`).
- Якщо slug відсутній, кнопка `Читати` disabled.

---

## 9) Що важливо про auth

Сторінка не вимагає авторизації для рендеру.

- Дані завантажуються через `http.ts`.
- Якщо access-token є, він додається автоматично.
- Якщо токена немає, запит все одно виконується (endpoint публічний у поточній backend-конфігурації).

---

## 10) Кнопка «Стати новим перекладачем»

На сторінці покинутої книги (`BookDetailReader.tsx`) відображається кнопка для подачі заявки на переклад.

### Де підключено

- Кнопка: `catalog/sections/BookHero.tsx` — проп `onBecomeTranslator`. Показується лише коли `book.translation_status === "ABANDONED"`.
- Модалка підтвердження: `catalog/ModalBecomeTranslator.tsx` — кнопки «Підтвердити» / «Скасувати».
- API: `catalogApi.ts` → `applyBecomeTranslator(slug)` → `POST /api/catalog/books/<slug>/apply-translator/`.

### Потік

1. Користувач натискає «Стати новим перекладачем».
2. Якщо не авторизований → відкривається модалка входу.
3. Якщо авторизований → модалка підтвердження `ModalBecomeTranslator`.
4. Після підтвердження → POST запит.
5. Успіх → `showSuccessAutoClose(...)`.
6. 409 → «Ви вже подали заявку».
7. Інша помилка → `showErrorAutoClose(...)`.

### Бекенд

- View: `apply_become_translator` в `apps/catalog/api/views.py`.
- Модель: `TranslatorApplication` в `apps/catalog/models.py` — `book`, `user`, `status` (PENDING/APPROVED/REJECTED), `created_at`, `reviewed_at`.
- Унікальність: одна PENDING-заявка на пару user+book.
- При створенні → `Notification` для користувача.
- Адмінка: proxy-модель `BookTranslatorReview` + `TranslatorApplicationInline` в `apps/catalog/admin.py`. Кожна книга з PENDING-заявками — один рядок у списку; inline-таблиця з кнопками «Схвалити» / «Відмовити» для кожного заявника. Custom admin URL для approve/reject дій. Детальніше: `backend/docs/ABANDONED_TRANSLATIONS_BACKEND.md`, секція 7.

---

## 11) Пов’язані документи

- `frontend/src/docs/Concept.md`
- `frontend/src/docs/STRUCTURE.md`
- `frontend/src/docs/COMPONENTS.md`
- `backend/docs/ABANDONED_TRANSLATIONS_BACKEND.md`
