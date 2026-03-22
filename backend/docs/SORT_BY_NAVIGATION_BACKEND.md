# Сортування для кнопки "Сортувати за" (Backend)

Документ описує роль backend у сортуванні списків, які на frontend змінюються через `SortByNavigation`.

---

## 1) Ключовий факт

Для сторінок з `SortByNavigation` backend переважно віддає один базовий порядок або просто список, а перемикання варіантів `Сортувати за` виконується на frontend.

Тобто вибір опції в `SortByNavigation` сам по собі не викликає окремий API-запит з параметром сортування.

---

## 2) Endpoint-и і фактична роль backend

### Каталог (`/api/catalog/books/reader/`)

- Файл: `backend/apps/catalog/api/views.py`
- Клас: `BookReaderViewSet`
- Базовий порядок у queryset: `.order_by('-last_updated')`
- `list()` повертає весь масив без пагінації.

Frontend після отримання масиву додатково пересортовує його за `created/views/income`.

### Покинуті переклади (`/api/catalog/abandoned-translations/`)

- Файл: `backend/apps/catalog/api/views.py`
- Функція: `abandoned_translations`
- Фільтр: `translation_status='ABANDONED'`
- Явного `order_by(...)` у цій функції немає.

Frontend застосовує локальне сортування (`created/updated/...`) до отриманого масиву.

### Закладки (`/api/navigation/bookmarks/`)

- Файл: `backend/apps/navigation/api/views.py`
- Клас: `BookmarkViewSet`
- `list()`:
  - підтримує фільтр `?status=...`;
  - застосовує `.order_by('-updated_at')`.
- **Аналітика (ТОП / метрики):** при створенні закладки викликається `record_bookmark_added`, при видаленні — `record_bookmark_removed` (див. **ANALYTICS_BOOKS_BACKEND.md**).

Frontend додатково може пересортувати локально за `updated/created/title`.

### Перекладачі (`/api/users/translators/`)

- Файл: `backend/apps/users/api/views.py`
- Функція: `get_translators_list`
- До серіалізації список профілів сортується у Python за кількістю книг (спадно).

Frontend додатково пересортовує таблицю під поточну опцію (`books/comments/lastVisit`).

### Автори (`/api/users/authors/`)

- Файл: `backend/apps/users/api/views.py`
- Функція: `get_authors_list`
- До серіалізації список профілів сортується у Python за кількістю авторських книг (спадно).

Frontend додатково пересортовує таблицю під поточну опцію (`books/comments/lastVisit`).

---

## 3) Що немає на backend зараз

- Немає окремих query-параметрів на кшталт `?sortBy=...` для варіантів кнопки `Сортувати за` на цих сторінках.
- Немає окремого endpoint для сторінки пошуку у поточному наборі сторінок, де вже підключено `SortByNavigation`.
- Для `CreateBookPage` немає backend-логіки кнопки `Сортувати за`, бо на цій сторінці у фронтенді немає такого елемента.

---

## 4) Висновок

У поточній архітектурі:

- backend відповідає за видачу даних і базовий початковий порядок (де він заданий);
- frontend відповідає за перемикання опцій `Сортувати за` і фінальний порядок у UI.
