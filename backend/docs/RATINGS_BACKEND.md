# Рейтинги книг — інженерний опис (backend)

Документ для розробників: **що саме робить система**, де код, **що ламати не можна** при рефакторингу.

---

## 1. Джерело правди: тип книги

У **`catalog.Book`** поле **`book_type`**: `AUTHOR` | `TRANSLATION`.

Від нього залежить **все**:

- які **типи** оцінок (`BookRating.rating_type`) дозволені;
- що повертає **GET** рейтингів (`translation_rating: null` vs об’єкт);
- як рахується **`overall_rating`** (якість / порівняння книг);
- як зважуються **лічильники** в ТОП/трендах (див. нижче — це **не** те саме, що `overall_rating`).

**Неправильно формулювати:** «API повертає рейтинг книги».

**Правильно:** «API працює з двома **логічними** типами оцінки — `BOOK` і `TRANSLATION`, але запис із `rating_type=TRANSLATION` **дозволений лише для книг з `book_type=TRANSLATION`**. Для `AUTHOR` другий тип **не існує в домені**, а не «дорівнює нулю».

---

## 2. Модель `BookRating` (`apps/rating/models.py`)

| Поле | Зміст |
|------|--------|
| `book`, `user` | FK |
| `rating_type` | `BOOK` або `TRANSLATION` (рядок у БД) |
| `rating` | 1–5 |
| Унікальність | `(book, user, rating_type)` — одна оцінка на тип на користувача |

**Захист домену на рівні моделі:** `clean()` + `save()` викликає `full_clean()`. Якщо `rating_type=TRANSLATION`, а книга `AUTHOR` — `ValidationError`.

**Обходиться:** `QuerySet.update()`, сирий SQL, `bulk_create` без виклику `save()` — можна зіпсувати дані. Рефакторинг **не** прибирати `full_clean()` без заміни іншим захистом.

---

## 3. Доменні правила (`apps/rating/domain.py`)

| Функція | Поведінка |
|---------|-----------|
| `available_rating_types(book_type)` | `AUTHOR` → `["BOOK"]`; `TRANSLATION` → `["BOOK","TRANSLATION"]`; невідомий тип → **лише** `["BOOK"]` (безпечний дефолт). |
| `translation_rating_applicable(book_type)` | `True` **тільки** для `TRANSLATION`. |
| `compute_overall_rating(...)` | Зведена оцінка **якості для порівняння**: для `TRANSLATION` — середнє `(BOOK + TRANSLATION)/2` за агрегатами; для всіх інших (включно з `AUTHOR`) — **лише** середнє по `BOOK`. |

**Не плутати** з ТОП/трендами: там інша формула (події/ваги), див. §7.

---

## 4. API

Префікс: **`/api/rating/`** (див. `apps/api/urls.py` + `apps/rating/api/urls.py`).

### 4.1 `GET /api/rating/<book_slug>/book-ratings/`

**Права:** гість може читати.

**Відповідь 200** — **контракт після змін домену** (обов’язково узгоджувати з фронтом):

```json
{
  "book_type": "AUTHOR",
  "available_rating_types": ["BOOK"],
  "has_translation_rating": false,
  "overall_rating": 4.2,
  "book_rating": { "average": 4.2, "total_votes": 10 },
  "translation_rating": null,
  "user_ratings": [ { "rating_type": "BOOK", "rating": 5 } ]
}
```

Для **`TRANSLATION`**-книги: `has_translation_rating: true`, `translation_rating` — **об’єкт** `{ average, total_votes }`, не `null` (навіть якщо голосів 0 — тоді `average` 0, це «немає голосів», а не «не застосовується»).

`user_ratings` фільтруються по `available_rating_types` — зайві типи (наприклад, історичний сміття) у відповідь не потрапляють.

### 4.2 `POST /api/rating/`

**Права:** авторизований + `check_book_access_permission(..., 'rate')` (див. `catalog/api/permissions.py`).

Тіло: `book_slug`, `rating_type`, `rating`.

**Серіалізатор** (`BookRatingSerializer`) відхиляє `rating_type=TRANSLATION`, якщо книга `AUTHOR` (дублює домен разом із моделлю).

**Аналітика:** новий запис (не оновлення значення) викликає `record_book_rating_created` / `record_translation_rating_created`; зміна лише цифри в існуючому рядку — лічильники **не** +1 (логіка в `create` серіалізатора).

### 4.3 `DELETE` та інші дії ViewSet

При видаленні оцінки — `record_book_rating_removed` / `record_translation_rating_removed`.

---

## 5. Дані та міграції

**`rating/migrations/0003_remove_translation_ratings_for_author_books.py`**

- Видаляє всі `BookRating` з `rating_type=TRANSLATION` і `book__book_type=AUTHOR`.
- Потім **`recompute_book_analytics_totals()`** — перерахунок `BookAnalytics` з джерел.

Після деплою на середовище, де міграція ще не застосована — виконати `migrate`. Історичні **DailyAnalytics** при потребі перебудовуються окремо (вікно днів — як у `rebuild`).

---

## 6. Rebuild аналітики (`apps/analytics_books/services/rebuild.py`)

Підрахунок **`translation_ratings`** у підсумках ведеться **тільки** для оцінок, де **`book__book_type="TRANSLATION"`**. Інакше старі помилкові рядки знову «накачують» лічильник.

---

## 7. ТОП і тренди vs «якість книги»

- **`overall_rating`** (GET рейтингів) — про **порівняння якості** (середні зірки за правилами домену).
- **ТОП / тренди** використовують **`weighted_daily_score`** у **`apps/analytics_books/services/scoring.py`**: зважені події (`views`, `comments`, **`book_ratings`**, **`translation_ratings`**, …) з **іншими коефіцієнтами**.

Щоб **AUTHOR** не програвав лише через один допустимий канал рейтингу:

- **`AUTHOR`:** у формулі очок участь **`book_ratings` з вагою ×6** (умовно «повний» рейтинговий бюджет).
- **`TRANSLATION`:** **`book_ratings×3 + translation_ratings×3`**.

`daily_row_score` / `book_analytics_total_score` беруть **`book.book_type`** через **`_scoring_book_type`**; для рядків `DailyAnalytics` потрібен **`select_related("book")`**, інакше зайві запити або некоректний тип.

**Важливо:** це **не** заміна пошуку за `overall_rating`. **`apps/search/filters.py`** (BookFilter) **не** містить сортування за рейтингом якості — якщо додаватимете, рахуйте **аналог домену** (`compute_overall_rating` / анотації з `BookRating`), а не копіюйте сліпо лічильники ТОПу.

---

## 8. Legacy endpoint аналітики

**`apps/analytics_books/api/views.py`** — `UpdateAnalyticsView`: для дій `translation_rating` / `translation_rating_removed` на книзі **`AUTHOR`** повертається **400** (узгоджено з доменом).

---

## 9. Чеклист при зміні коду

1. Змінили GET — оновити **`frontend`** (`ratingApi.ts`, нормалізація) і цей документ.
2. Змінили правила допустимих типів — **`domain.py`**, серіалізатор, модель, **GET**, фронт.
3. Змінили ваги ТОПу — **`scoring.py`**, за потреби тести/аудит (`audit_top_eligibility.py`).
4. Не покладайтеся на «`translation_rating` завжди об’єкт»: для **AUTHOR** це **`null`** за контрактом.

---

**Останнє оновлення документа:** 2026-03-29 (домен AUTHOR/TRANSLATION, контракт GET, аналітика, міграція 0003).
