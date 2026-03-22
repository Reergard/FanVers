# Списки та каруселі (Frontend)

Документ про **горизонтальні каруселі та підбірки книг** у UI: звідки дані, які компоненти, чим відрізняються сценарії.

**Терміни:** **ТОП** — рейтинг за зваженою активністю за періодом (`GET /api/analytics_books/top/`). **Тренди** — майбутній окремий розділ з іншою логікою (зараз у `MagicalGuide1` лише заглушка-текст).

---

## 1. Головна сторінка (`/`)

| Блок | Файл | Джерело даних | API (бекенд) |
|------|------|---------------|--------------|
| **НОВИНКИ** | `main/HomePage2.tsx` | React Query + `mainApi.getBooksNews()` | `GET /api/main/books-news/` |
| **ОСТАННІ ОНОВЛЕННЯ** | `main/HomePage3.tsx` | `getBooksRecentUpdates()` з `mainApi` | `GET /api/main/books-recent-updates/` |
| Реклама (якщо є секція) | `website_advertising/AdvertisingBooks.tsx` тощо | Окремі запити реклами | Див. **ADVERTISING_STAFF_UA.md** / **ADVERTISING_BOOK_SETTINGS_FLOW.md** |

Ці блоки **не** використовують ендпоінт ТОПу.

---

## 2. Сторінка «Чарівний Гід» (`/MagicalGuide`)

**Файли:** `main/MagicalGuide.tsx`, `MagicalGuide1.tsx`, `MagicalGuide2.tsx`, `MagicalGuide3.tsx`.

| Секція | Компонент | Дані |
|--------|-----------|------|
| **Тренди** (майбутнє) | `MagicalGuide1` | Заглушка: окремий продукт «Тренди», не ТОП. |
| **Рекомендації** | `MagicalGuide2` | Локальні заглушки. |
| **ТОП** | `MagicalGuide3` | **`useTopBooks(period)`** → **`GET /api/analytics_books/top/?type=day|week|month|all_time`**. Вкладки зверху; карусель посторінково. |

---

## 3. ТОП за періодом (бекенд + фронт)

### 3.1. API

- **GET** `/api/analytics_books/top/?type=<period>`
- **`type`:** `day` | `week` | `month` | `all_time` — інакше **400**.
- **Відповідь:** масив **`BookReaderSerializer`**. Нормалізація: `api/top/normalizeTopReaderRow.ts`, маппінг у `Book`: `api/top/mapTopBook.ts`.

### 3.2. Файли фронтенду

| Призначення | Шлях |
|-------------|------|
| URL | `api/endpoints.ts` → `topBooks` |
| Запит | `api/top/topApi.ts` (`getTopBooks`) |
| Хук | `shared/hooks/useTopBooks.ts` (`queryKey`: `["top-books", period]`) |
| UI | `main/MagicalGuide3.tsx` |

### 3.3. Аналітика

Лічильники оновлюються на сервері; окремий виклик analytics з фронту для ТОПу **не** потрібен. Див. **ANALYTICS_FRONTEND.md**, **backend/docs/ANALYTICS_BOOKS_BACKEND.md**.

---

## 4. Інші списки (не каруселі)

Каталог, пошук, закладки, власні переклади тощо — див. **STRUCTURE.md**, **BOOK_CARDS_FRONTEND.md**, **SORT_BY_NAVIGATION_FRONTEND.md**.

---

## 5. Пов’язані документи

- Бекенд: **`backend/docs/LISTS_AND_CAROUSELS_BACKEND.md`**, **`backend/docs/ANALYTICS_BOOKS_BACKEND.md`**
- Картка книги: **BOOK_CARDS_FRONTEND.md**, **COMPONENTS.md**

---

**Останнє оновлення:** 2026-03-21 (ТОП у `MagicalGuide3`; «Тренди» винесені окремо)
