# Пагінація та кнопка "Показати ще" (Frontend)

Документ описує поточну реалізацію пагінації в інтерфейсі через кнопку `Показати ще` **строго за кодом**.

---

## 1) Що це за пагінація

У проєкті використовується **клієнтська (frontend-only) пагінація**:

- бекенд віддає список елементів повністю;
- сторінка зберігає локальний лічильник `visibleCount`;
- рендериться `items.slice(0, visibleCount)`;
- кнопка `Показати ще` збільшує `visibleCount`.

На момент цього документа в усіх підключених сторінках стоїть **тестовий крок `1`**.

---

## 2) Базовий компонент

### `frontend/src/navigation/ShowMoreNavigation.tsx`

Відповідає за єдину поведінку кнопки:

- приймає `visibleCount`, `totalCount`, `onShowMore`;
- обчислює `hasMore = visibleCount < totalCount`;
- якщо `hasMore === false`, повертає `null` (кнопка не рендериться);
- якщо `hasMore === true`, рендерить `ShowMoreButton` і передає в нього `onClick`.

### `frontend/src/navigation/ShowMoreNavigation.module.css`

- контейнер кнопки (`display: flex; justify-content: center; width: 100%`).

### `frontend/src/shared/ActionButton/ActionButton.tsx`

`ShowMoreNavigation` використовує `ShowMoreButton`, який:

- є спеціалізацією `ActionButton` з `variant="showMore"`;
- рендерить нативний `<button>` (коли не передано `to`/`as="a"`);
- прокидує `onClick` як є;
- має `aria-label` та іконку стрілки з `sprite-book.svg`.

---

## 3) Послідовність від кліку до результату

1. Користувач натискає `Показати ще`.
2. Спрацьовує `onShowMore` сторінки (наприклад `setVisibleCount(prev => prev + PAGE_SIZE)`).
3. Компонент сторінки перерендерюється.
4. `slice(0, visibleCount)` повертає більший фрагмент масиву.
5. UI показує додаткові елементи.
6. Коли `visibleCount >= totalCount`, `ShowMoreNavigation` повертає `null`, і кнопка зникає.

---

## 4) Де використовується

> У всіх прикладах нижче `PAGE_SIZE`/`TAG_GROUPS_PAGE_SIZE` зараз дорівнює `1` (тестовий режим).

### `frontend/src/catalog/Catalog.tsx`

- Дані: `getAllCatalogBooks()` (`/api/catalog/books/reader/`).
- Логіка:
  - `visibleCount` state;
  - `visibleBooks = sortedBooks.slice(0, visibleCount)`;
  - `showMore = () => setVisibleCount(prev => prev + PAGE_SIZE)`.
- Скидання:
  - `useEffect(() => setVisibleCount(PAGE_SIZE), [sortBy, sourceBooks.length])`.
- Кнопка:
  - `<ShowMoreNavigation visibleCount={visibleCount} totalCount={sortedBooks.length} ... />`.

### `frontend/src/catalog/AbandonedTranslations.tsx`

- Дані: `getAbandonedTranslations()` (`/api/catalog/abandoned-translations/`).
- Логіка:
  - `visibleBooks = filteredBooks.slice(0, visibleCount)`;
  - `onShowMore={() => setVisibleCount(prev => prev + PAGE_SIZE)}`.
- Скидання:
  - `useEffect(..., [searchQuery, sortBy, checkValues])`.
- Кнопка:
  - `<ShowMoreNavigation totalCount={filteredBooks.length} ... />`.

### `frontend/src/bookmarks/BookmarksPage.tsx`

- Дані: `getUserBookmarks(...)` (`/api/navigation/bookmarks/` + опційний `?status=`).
- Логіка:
  - `visibleBookmarks = bookmarks.slice(0, visibleCount)`.
- Скидання:
  - `useEffect(..., [selectedStatus, bookmarks.length])`.
- Кнопка:
  - `<ShowMoreNavigation totalCount={bookmarks.length} ... />`.

### `frontend/src/users/UserTranslations.tsx`

- Дані: `getUserTranslations()` (`/api/catalog/user-translations/`).
- Логіка:
  - `visibleBooks = books.slice(0, visibleCount)`.
- Скидання:
  - `useEffect(..., [books.length])`.
- Кнопка:
  - `<ShowMoreNavigation totalCount={books.length} ... />`.

### `frontend/src/users/Authors.tsx`

- Дані: `getAuthorsList()` (`/api/users/authors/`).
- Логіка:
  - `visibleRows = sortedRows.slice(0, visibleCount)`.
- Скидання:
  - `useEffect(..., [sort, apiRows.length])`.
- Кнопка:
  - `<ShowMoreNavigation totalCount={sortedRows.length} ... />`.

### `frontend/src/users/TranslatorsList.tsx`

- Дані: `getTranslatorsList()` (`/api/users/translators/`).
- Логіка:
  - `visibleRows = sortedRows.slice(0, visibleCount)`.
- Скидання:
  - `useEffect(..., [sort, apiRows.length])`.
- Кнопка:
  - `<ShowMoreNavigation totalCount={sortedRows.length} ... />`.

### `frontend/src/notification/NotificationsPage.tsx`

- Дані: `useNotifications(isAuthenticated)` (`/api/notification/notifications/`); той самий хук використовується в `Header` для лічильника непрочитаних (спільний ключ React Query `["notifications"]`). Деталі — `docs/NOTIFICATIONS_FRONTEND.md`.
- Логіка:
  - `visibleNotifications = notifications.slice(0, visibleCount)`.
- Скидання:
  - `useEffect(..., [notifications.length])`.
- Кнопка:
  - `<ShowMoreNavigation totalCount={notifications.length} ... />`.

### `frontend/src/catalog/CreateBookPage.tsx` (спеціальний випадок)

Тут кнопка використовується не для книг/користувачів, а для груп тегів:

- `tagGroupsToShow = tagGroups.slice(0, tagGroupsVisibleCount)`;
- `showMoreTagGroups` збільшує `tagGroupsVisibleCount`;
- скидання при зміні довжини `tagGroups`.

---

## 5) Особливості та перевірки

- `ShowMoreNavigation` не має власного стану, тільки перевірку `visibleCount < totalCount`.
- На сторінці кнопка не відображається, якщо:
  - список порожній;
  - елементів вже показано стільки ж або більше, ніж є в `totalCount`.
- Негативні значення `visibleCount/totalCount` у коді не використовуються.
- Серверну пагінацію (`page`, `limit`, `offset`) ці сторінки не використовують.

---

## 6) Де ще немає

- У поточному `frontend/src` немає окремої сторінки пошуку (`Search*.tsx`), тому `Показати ще` там поки не підключено.

---

## 7) Серверна пагінація розділів на сторінці книги

Окремо від «Показати ще» на сторінці `/books/:slug` список розділів завантажується **серверно**:

- `BookChapters` → `getPaginatedChapters(bookId, rangeStart)`;
- при >50 розділах — `ChapterRangeNavigation` (селектор діапазонів `1-50`, `51-100`, …);
- правила розміру сторінки на backend: 50 (51–999 глав), 100 (1000+).

Детально: `CHAPTER_PAGINATION_FRONTEND.md`, `backend/docs/CHAPTER_PAGINATION_BACKEND.md`.

---

## 8) Пов’язані файли

- `frontend/src/navigation/ShowMoreNavigation.tsx`
- `frontend/src/navigation/ShowMoreNavigation.module.css`
- `frontend/src/shared/ActionButton/ActionButton.tsx`
- `frontend/src/catalog/Catalog.tsx`
- `frontend/src/catalog/AbandonedTranslations.tsx`
- `frontend/src/bookmarks/BookmarksPage.tsx`
- `frontend/src/users/UserTranslations.tsx`
- `frontend/src/users/Authors.tsx`
- `frontend/src/users/TranslatorsList.tsx`
- `frontend/src/notification/NotificationsPage.tsx`
- `frontend/src/catalog/CreateBookPage.tsx`
- `frontend/src/navigation/ChapterRangeNavigation.tsx` (серверна пагінація розділів — не «Показати ще»)
