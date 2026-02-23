# Сторінка пошуку — Frontend

Документ описує фактичну реалізацію сторінки `Пошук` у поточному коді, без припущень.

---

## 1) Де знаходиться сторінка

- Сторінка: `frontend/src/search/search.tsx`
- Стилі: `frontend/src/search/search.css` (імпортує `AbandonedTranslations.css`)
- Роут: `frontend/src/App.tsx` -> `path="/search"`

---

## 2) Які файли задіяні

### UI і навігація
- `frontend/src/search/search.tsx`
- `frontend/src/navigation/SortByNavigation.tsx`
- `frontend/src/navigation/ShowMoreNavigation.tsx`
- `frontend/src/navigation/FilterDropdown.tsx`
- `frontend/src/shared/Icon.tsx`
- `frontend/src/BookCard/BookCard.tsx`

### Дані і API
- `frontend/src/api/searchApi.ts` — запит пошуку і збір query-рядка
- `frontend/src/api/endpoints.ts` — `API.bookSearch`
- `frontend/src/api/catalogApi.ts` — довідники (`getGenres/getTags/getCountries/getFandoms`) і тип `Book` (включно з `bookmark_status/bookmark_id`)
- `frontend/src/api/http.ts` — axios-клієнт
- `frontend/src/auth/useAuth.ts` — auth-стан для пошуку
- `frontend/src/shared/NotificationModal/NotificationProvider.tsx` — warning для гостя на чекбоксі закладок

### Глобальна настройка 18+
- `frontend/src/settings/adultContentStore.ts`
- `frontend/src/settings/useAdultContent.ts`
- `frontend/src/users/Profile.tsx` (чекбокс "Прибрати 18+" + підтвердження)

### Технічний хук
- `frontend/src/shared/hooks/useDebouncedValue.ts`

---

## 3) Як працює пошук (по кроках)

1. Користувач відкриває `/search`.
2. Сторінка читає `q` із URL і кладе в `searchQuery`.
3. `searchQuery` та `filters` проходять через debounce 500ms (`useDebouncedValue`).
4. Формуються `effectiveFilters`, де `adult_content = !hideAdultContent`.
5. `useQuery` викликає `searchBooks(effectiveFilters)` (автопошук).
6. Результати рендеряться картками `BookCard`.
7. URL параметр `q` оновлюється з debounce через `setSearchParams(..., { replace: true })`.

Нотатка про кеш:

- ключ автопошуку залежить не тільки від `effectiveFilters`, а й від auth-стану (`isAuthenticated`, `userId`, `authReady`), щоб не змішувати кеш гостя і авторизованого користувача.

---

## 4) Що відбувається при натисканні Enter / кнопки "Пошук"

Викликається `runSearchNow()`:

- бере поточні (не debounced) `searchQuery` і `filters`;
- робить примусовий запит через `queryClient.fetchQuery(...)`;
- при успіху віддає `forcedData` у рендер;
- при помилці ставить `forcedError` і показує повідомлення.

Це дає миттєвий пошук без очікування 500ms.

---

## 5) Фільтри і параметри

У стані сторінки є такі фільтри:

- `genres`, `tags`, `fandoms`, `countries`
- `exclude_genres`, `exclude_tags`, `exclude_fandoms`
- `min_chapters`, `max_chapters`
- `order`

У запит додатково додається:

- `adult_content = !hideAdultContent` (це формується в `effectiveFilters`, а не зберігається у базовому state `filters`).

Параметри збираються в `searchApi.ts` через `URLSearchParams`.

---

## 6) Відомі обмеження (поточний код)

1. **Чекбокс `Тільки переглянуті` (`viewedOnly`) не впливає на результат**:
   
   Його state перемикається, але не передається в API і не застосовується в клієнтській фільтрації.

2. **Чекбокс `Не показувати закладки` (`hideBookmarks`) працює тільки для авторизованого користувача**:

   - для авторизованого користувача книги ховаються, якщо в результаті пошуку `book.bookmark_status !== null`;
   - для гостя перемикання блокується, показується warning `Увійдіть, щоб приховати закладки.`.

## 7) UI фільтрів (Dropdown)

- Для фільтрів використовується `navigation/FilterDropdown.tsx`, прив’язаний до натиснутого пункту (`Жанри/Теги/...`).
- Dropdown підтримує множинний вибір (multi-select) у списках.
- Під час відкриття dropdown блокується прокрутка сторінки (`useScrollLock`), щоб скрол працював тільки в списку dropdown.
- Ширина dropdown адаптується під вміст (з обмеженням по viewport).

---

## 8) Стан сторінки і перевірки

- Loading: `searchQueryResult.isFetching || isForceFetching`
- Error: `searchQueryResult.isError || forcedError !== null`
- Empty: якщо після фільтрації немає книг
- "Показати ще": через `ShowMoreNavigation` (клієнтська пагінація)

---

## 9) Що не змінювалось

- Логіка сторінки `Покинуті переклади` (`catalog/AbandonedTranslations.tsx`) не є частиною пошуку.
- Документація цієї сторінки: `frontend/src/docs/ABANDONED_TRANSLATIONS_FRONTEND.md`.

