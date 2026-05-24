# Прогрес читання (Backend)

Документ описує **`apps/monitoring`**: збір прогресу по главах, статистику читання, зв’язок з рейтингом/коментарями та аналітикою для автора.

---

## 1. Навіщо це в системі

| Що робить | Де видно |
|-----------|----------|
| Зберігає скрол і час читання по главах | Адмінка → **Моніторинг → Прогрес читання** |
| Визначає `is_read` (дочитав розділ) | Ті самі записи + логіка в `ChapterProgressView` |
| Статистика для профілю читача | `GET /api/monitoring/stats/` |
| Обмеження рейтингу / коментарів | `rating`, `reviews` (див. §6) |
| Метрики на `/my-translations` | `GET /api/catalog/user-translations/` — `total_readers`, `completed_readers` |

**Не впливає на:** покупки, закладки, доступ до глав (`CHAPTER_ACCESS_BACKEND.md`), ТОП/тренди (окремі лічильники в `analytics_books`), комісію за символи.

---

## 2. Модель `UserChapterProgress`

Файл: **`apps/monitoring/models.py`**.

Один рядок = **користувач + глава** (`unique_together`).

| Поле | Зміст |
|------|--------|
| `user`, `chapter` | FK |
| `is_read` | `True` — глава зарахована як прочитана (правила §4) |
| `is_purchased` | `True` — виставляється при **покупці** в `subscription/services.py`, **не** в `ChapterProgressView` |
| `scroll_position` | 0–100, сирий % прокрутки сторінки (з фронта) |
| `reading_time` | секунди накопиченого читання (з фронта) |
| `reading_speed` | `character_count / reading_time` при першому `is_read=True` |
| `last_read_at` | `auto_now` при кожному POST |

**Властивість для адмінки:**

```python
reading_progress = min(100, (scroll_position / 90) * 100)
```

90% скролу = 100% «прогресу» в UI (футер/навігація внизу).

Індекси: `[user, chapter]`, `[is_read]`, `[user, is_read]` тощо.

---

## 3. Розрахунок часу на главі (`Chapter`)

Файл: **`apps/catalog/models.py`** (при збереженні контенту / `rebuild_derived`).

- `reading_time = int((plain_text_len / 1000) * 180)` сек (~3 хв на 1000 символів)
- `min_reading_time = int(reading_time * 0.75)` — мінімум для зарахування `is_read`

Детальніше про символи: **CHARACTERS_COUNT_COMMISSION_BACKEND.md**.

---

## 4. API прогресу глави

Префікс: **`/api/monitoring/`** (`apps/monitoring/api/urls.py`).

### `GET|POST /api/monitoring/chapters/<chapter_id>/progress/`

Клас: **`ChapterProgressView`** (`apps/monitoring/api/views.py`).  
**Auth:** `IsAuthenticated`.

**POST body:**

```json
{ "reading_time": 245, "scroll_progress": 78.5 }
```

Поле `scroll_speed` **не використовується** (історичний артефакт старого фронта).

**Логіка POST:**

1. `get_or_create(user, chapter)`
2. Завжди оновлює `reading_time`, `scroll_position` (= `scroll_progress`), `last_read_at`
3. Якщо ще **не** `is_read`:
   - `scroll_progress >= 90`
   - `reading_time >= chapter.min_reading_time`
   - обидва true → `is_read = True`, `reading_speed = character_count / reading_time`
4. При першому `is_read` у відповіді може бути `book_completed: true/false` (усі глави книги з `is_read` у цього користувача)
5. `save()` → **`UserChapterProgressSerializer`**

**GET:** перший запис або `null` — серіалізатор з `instance=None` (клієнт обробляє порожню відповідь).

**Відповідь:** `is_read`, `is_purchased`, `scroll_position`, `reading_time`, `last_read_at`, `reading_progress` (+ опційно `book_completed`).

### `GET /api/monitoring/stats/`

Клас: **`UserReadingStatsView`**. Throttle: scope `monitoring`.

```json
{
  "purchased_chapters": 15,
  "read_chapters": 42,
  "completed_books": 3
}
```

| Поле | Джерело (реальний API) |
|------|-------------------------|
| `purchased_chapters` | `UserChapterAccess` (підписка/покупки) |
| `read_chapters` | `UserChapterProgress` з `is_read=True` |
| `completed_books` | `Bookmark` з `status='completed'` |

**Не плутати** з `UserChapterProgress.get_user_stats()` у моделі — там `completed_books` рахується як «усі глави книги прочитані»; ендпоінт `/stats/` так **не** робить.

### `POST /api/monitoring/thanks/`

Подяка автору — **BOOK_AUTHOR_THANKS_BACKEND.md** (окремий потік).

---

## 5. Побічні ефекти

- **`post_save` на `UserChapterProgress`** → `Profile.clear_reading_stats_cache()` (`apps/users/models.py`).
- **`is_purchased`** у прогресі — при покупці в **`subscription/services.py`** (`update_or_create` з `defaults={'is_purchased': True}`).

---

## 6. Обмеження рейтингу та коментарів

Перевірка **після** `check_book_access_permission`. **Власник/творець книги** (`is_book_owner_or_creator`) — **без** перевірки прогресу (як і для `rate` / `comment_*`).

### Рейтинг

Файл: **`apps/rating/api/views.py`**, `BookRatingViewSet.create`.

- Потрібно: `UserChapterProgress` з `user=request.user`, `chapter__book=book`, `is_read=True` (хоча б одна глава).
- 403: `{'error': 'Щоб оцінити книгу, потрібно прочитати хоча б один розділ'}`.

### Коментар до книги

Файл: **`apps/reviews/api/views.py`**, `BookCommentViewSet.create`.

- Те саме, що рейтинг (будь-яка прочитана глава цієї книги).
- 403: `{'detail': 'Щоб залишити коментар, потрібно прочитати хоча б один розділ'}`.

### Коментар до глави

Файл: **`apps/reviews/api/views.py`**, `ChapterCommentViewSet.create`.

- Потрібно: `is_read=True` для **цієї** глави (`chapter=chapter`).
- 403: `{'detail': 'Щоб залишити коментар, потрібно прочитати цей розділ'}`.

Деталі API коментарів: **COMMENTS_BACKEND.md**, рейтингів: **RATINGS_BACKEND.md**.

---

## 7. Аналітика для автора (`user_translations`)

Файл: **`apps/catalog/api/views.py`**, функція **`user_translations`**.

`GET /api/catalog/user-translations/` — книги `owner=request.user` + статистика.

| Поле | Розрахунок |
|------|------------|
| `daily_income` | `Sum(TransactionLog.final_amount)` за сьогодні, `owner=profile`, `book=book` |
| `monthly_income` | те саме з `created_at__date >= 1-е число місяця` |
| `daily_views` | `BookView.get_daily_views(book, today)` — унікальні авторизовані за день |
| `total_readers` | унікальні `user` з `UserChapterProgress` (`chapter__book=book`, `is_read=True`) |
| `completed_readers` | користувачі, у яких `Count(chapter, distinct=True)` з `is_read=True` == `book.chapters.count()` |

Покупка глави → `TransactionLog` — **SUBSCRIPTION_BACKEND.md**, **BALANCE_DEPOSIT_WITHDRAW_BACKEND.md**.

Фронт: **READING_PROGRESS_FRONTEND.md**, **BOOK_CARDS_FRONTEND.md**.

---

## 8. Адмінка

**Моніторинг → Прогрес читання** (`UserChapterProgressAdmin`): user, chapter, is_read, is_purchased, `reading_progress`, last_read_at; фільтри `is_read`, `is_purchased`, дата.

Загальний огляд адмінки: **ADMIN.md**.

---

**Останнє оновлення:** 2026-05-24 — прогрес читання, обмеження rate/comments, `total_readers` / `completed_readers` у `user_translations`.
