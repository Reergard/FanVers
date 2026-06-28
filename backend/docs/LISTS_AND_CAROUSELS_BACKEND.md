# Списки та каруселі (Backend)

Документ про **HTTP-видачу списків книг** для інтерфейсу: каруселі на головній, сторінці «Чарівний Гід», сторінці книги, реклама тощо. Дані для **ТОПу за періодом** беруться з накопиченої **аналітики** — див. **ANALYTICS_BOOKS_BACKEND.md**.

**Не плутати:** майбутні **«Тренди»** — окремий endpoint; поточний `GET .../top/` — **рейтинг за зваженою активністю** по `day` / `week` / `month` / `all_time`.

---

## 1. ТОП за періодом

### 1.1. Ендпоінт

- **GET** `/api/analytics_books/top/`
- **Query `type`:** лише `day` | `week` | `month` | `all_time`. Інакше **400**.

### 1.2. Поведінка

- **Ліміт:** до **9** книг (`day` / `week` / `month`), до **15** (`all_time`).
- **Фільтр:** `books_eligible_for_top()` — `view_permission='all'`, є `owner`, slug, обкладинка, ≥1 глава, без `ABANDONED` перекладів (`services/books_filter.py`).
- **Відповідь:** `BookReaderSerializer`.

**Файли:** `apps/analytics_books/api/views.py` (`TopBooksView`), `services/top.py`.

---

## 2. Інші списки для каруселей на головній

| Що в UI | URL | Де в коді |
|---------|-----|-----------|
| **Новинки** | `GET /api/main/books-news/` | `apps/main/api/views.py` → `books_news` |
| **Останні оновлення** | `GET /api/main/books-recent-updates/` | `books_recent_updates` |
| **Реклама** | окремі API реклами | `website_advertising` |

---

## 3. Сторінка книги — «Інші роботи автора»

Карусель **ІНШІ РОБОТИ АВТОРА** на `/books/:slug`.

### 3.1. Ендпоінт

- **GET** `/api/catalog/books/<slug>/author-works/`
- **Доступ:** `AllowAny`; спочатку `require_book_view_access` для **поточної** книги (як у `BookInfoView`).
- **View:** `author_other_works` у `apps/catalog/api/views.py`
- **URL name:** `catalog:author-other-works`

### 3.2. Логіка відбору

1. Книга за `slug`; якщо немає доступу до перегляду — **403**.
2. Якщо `book.owner_id` порожній — **`[]`** (карусель не показується).
3. Кандидати: `Book.objects.filter(owner_id=book.owner_id)`, **виключити** поточну `pk`.
4. Фільтри як у публічних списках: непорожній `slug`, є `image` (`Q(slug="")`, `Q(image="")` тощо — див. `books_filter.py`).
5. Сортування: `-last_updated`, `-id`.
6. До **`AUTHOR_OTHER_WORKS_SCAN_LIMIT` (200)** кандидатів перебираються по черзі; для кожного — `check_book_access_permission(user, candidate, 'view')`.
7. У відповідь потрапляє до **`AUTHOR_OTHER_WORKS_LIMIT` (24)** доступних книг.

**Важливо:** відбір лише за полем **`owner`** (власник платформи). Поле **`creator`** не використовується. Книги з `owner=NULL` не потрапляють у видачу «інших робіт», навіть якщо `creator` заповнений.

### 3.3. Відповідь

- **`BookReaderSerializer`** (масив), `context={'request': request}` — абсолютні URL обкладинок, `is_new_badge`, `book_type`, `adult_content` тощо.
- Фронт: `catalogApi.getAuthorOtherWorks(slug)` → `normalizeBook`.

### 3.4. Зв’язок з фронтендом

- Компонент: `catalog/sections/AuthorWorks.tsx`
- Документація UI: **frontend/src/docs/LISTS_AND_CAROUSELS_FRONTEND.md** §2

---

## 4. Зв’язок з фронтендом (загалом)

| Документ |
|----------|
| **frontend/src/docs/LISTS_AND_CAROUSELS_FRONTEND.md** |
| **frontend/src/docs/BOOK_PAGE_DATA_FLOW.md** |

---

**Останнє оновлення:** 2026-06-28 (`author-works`, owner-only, ліміти 24/200)
