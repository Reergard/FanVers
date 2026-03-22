# Списки та каруселі (Backend)

Документ про **HTTP-видачу списків книг** для інтерфейсу: каруселі на головній, сторінці «Чарівний Гід», реклама тощо. Дані для **ТОПу за періодом** беруться з накопиченої **аналітики** — як вона збирається, див. **ANALYTICS_BOOKS_BACKEND.md**.

**Не плутати:** майбутні **«Тренди»** (окрема логіка динаміки) — це **інший** endpoint і формула; поточний `GET .../top/` — це **рейтинг за зваженою активністю** по `day` / `week` / `month` / `all_time`.

---

## 1. ТОП за періодом

### 1.1. Ендпоінт

- **GET** `/api/analytics_books/top/`
- **Query `type`:** лише `day` | `week` | `month` | `all_time`. Інакше **400** з переліком дозволених.

### 1.2. Поведінка

- **Ліміт:** до **9** книг для `day` / `week` / `month`, до **15** для `all_time` (`top_limit_for_period` у `apps/analytics_books/services/top.py`).
- **Фільтр книг:** `books_eligible_for_top()` — `view_permission='all'`, є `owner`, непорожній `slug`, **обкладинка**, **хоча б одна глава**, переклади з `ABANDONED` виключені (`services/books_filter.py`).
- **Очки:** зважена формула з `services/scoring.py` (див. **ANALYTICS_BOOKS_BACKEND.md**): для `day` — сьогоднішній `DailyAnalytics`; для `week` — **7** календарних днів включно з сьогодні (`date >= today-6`); для `month` — **30** днів включно з сьогодні (`date >= today-29`); для `all_time` — **сума** зважених очок з **`BookAnalytics`** (`book_analytics_total_score`).
- **Пороги:** `MIN_TOP_SCORE_PERIOD` (3) для всіх періодів.
- **Сортування:** score за спаданням; tie-break — свіжіший `book.last_updated` / `created_at`, потім `id`.
- **Відповідь:** **`BookReaderSerializer`** (як у читацькому каталозі), порядок id — через `Case`/`When`.

**Файли:** `apps/analytics_books/api/views.py` (`TopBooksView`), `services/top.py`.

---

## 2. Інші списки для каруселей і блоків на головній

| Що в UI | Метод / URL (орієнтовно) | Де в коді |
|---------|---------------------------|-----------|
| **Новинки** (HomePage2) | `GET /api/main/books-news/` | `apps/main/api/views.py` → `books_news` |
| **Останні оновлення** (HomePage3) | `GET /api/main/books-recent-updates/` | `apps/main/api/views.py` → `books_recent_updates` |
| **Реклама** (каруселі на головній / каталозі / пошуку) | окремі API реклами | див. **ADVERTISING** у документації проекту, `website_advertising` |

Ці джерела **не** є `top/`; їх не слід плутати з ТОПом за аналітикою.

---

## 3. Зв’язок з фронтендом

- Карусель «ТОП» на `/MagicalGuide`: **frontend/src/docs/LISTS_AND_CAROUSELS_FRONTEND.md**.

---

**Останнє оновлення:** 2026-03-21 (перейменовано з «трендів» на ТОП; шлях `/top/`)
