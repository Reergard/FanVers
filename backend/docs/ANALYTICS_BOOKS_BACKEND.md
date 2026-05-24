# Аналітика книг (Backend)

Система збору й зберігання метрик по книгах: **що** рахується, **куди** пишеться, **навіщо** — щоб на їх основі будувати **ТОП за періодом** та інші підбірки (видача HTTP — окремий документ). Майбутні **«Тренди»** (окрема логіка) використовуватимуть інші правила.

**Джерело правди** — **дії в БД** (перегляд, коментар, закладка, рейтинг, лайк коментаря), а не окремий масовий виклик з фронту. Деталі видачі **ТОПу за періодом**: **LISTS_AND_CAROUSELS_BACKEND.md**.

---

## 1. Префікс API (лише оновлення / спадщина)

У корені: `path('analytics_books/', include('apps.analytics_books.api.urls'))` → база **/api/analytics_books/**.

| Метод | URL | Призначення |
|--------|-----|-------------|
| POST | **/api/analytics_books/update/** | Застарілий універсальний інкремент; залишено для сумісності. Для `action_type=view` — та ж унікальність, що в `register_book_view`. **GET ТОПу** — у **LISTS_AND_CAROUSELS_BACKEND.md**. |

---

## 2. Моделі (`apps/analytics_books/models.py`)

| Модель | Призначення |
|--------|-------------|
| **BookAnalytics** | Один рядок на книгу: суми `views_count`, `comments_count`, `book_ratings_count`, `translation_ratings_count`, `comment_likes_count`, `bookmarks_count`. |
| **DailyAnalytics** | За парою (книга, дата): ті самі метрики за календарний день (UTC). |
| **CommentLikeAnalyticsEvent** | Подія ±1 на книгу за день при лайку/знятті лайка з коментаря — щоб нічний перерахунок міг відновити **денний** `comment_likes` (у M2M коментаря немає часу події). |

Унікальні перегляди (авторизовані): **`apps/monitoring/models.py` → `BookView`** (user + book + день); при першому перегляді за день створюється рядок і зростають `BookAnalytics` / `DailyAnalytics.views`.

**Гості:** перегляди без авторизації **не** зараховуються в `BookView` і **не** збільшують зважені метрики ТОПу — свідома політика, поки немає стійкої унікальності по session/ip. ТОП тому відображає активність переважно зареєстрованих читачів.

**Окремо від переглядів:** прогрес читання розділів (`UserChapterProgress`, `is_read`) — **не** входить у зважені очки ТОПу; використовується для профілю, обмеження рейтингу/коментарів і полів `total_readers` / `completed_readers` на **GET /api/catalog/user-translations/** — **READING_PROGRESS_BACKEND.md**.

---

## 3. Формула зважених «очок» (`services/scoring.py`)

Використовується при розрахунку **ТОПу за періодом** і для узгодженості сенсу полів:

`views×1 + comments×2 + book_ratings×3 + translation_ratings×3 + comment_likes×1 + bookmarks×4`

Функції: `weighted_daily_score`, `daily_row_score`, `book_analytics_total_score`, `weighted_totals_for_period_dict` (сирі суми з `DailyAnalytics.get_analytics_for_period` → зважені очки). **ТОП для `all_time`** ранжує за **`book_analytics_total_score`**, див. `services/top.py`. У `DailyAnalytics` немає властивості «сума без ваг» — щоб не плутати з зваженими очками.

---

## 4. Де оновлюються лічильники

Усе через **`apps/analytics_books/services/analytics_counters.py`**: атомарні `F()`-оновлення, декременти через `Greatest(..., 0)`.

| Подія | Де в коді |
|--------|-----------|
| Перегляд книги (1 на користувача на день) | `register_book_view` → `record_unique_book_view_from_request`. **Лише авторизовані** (модель `BookView` вимагає user); гості не зміщують метрики — свідома політика, поки немає унікальності по session/ip. |
| Коментар створено / видалено | `apps/reviews/api/views.py` — book/chapter comments create/destroy/reply → `record_comment_*`. |
| Лайк / зняття лайка з коментаря | `LikeDislikeViewSet.update_reaction` → `record_comment_like_*` + **`CommentLikeAnalyticsEvent`**. **Лайк автора** (`owner_like`) не рахується. |
| Закладка додана / видалена | `apps/navigation/api/views.py` — `BookmarkViewSet` → `record_bookmark_*`. |
| Новий рейтинг BOOK / TRANSLATION | `apps/rating/api/serializers.py` — лише при **першому** створенні `BookRating`. |
| Видалення рейтингу | `apps/rating/api/views.py` — `perform_destroy` → `record_*_removed`. |

Сервіси перерахунку: **`services/rebuild.py`** (`run_full_analytics_repair`, `recompute_book_analytics_totals`, `rebuild_daily_analytics_for_date`). Денний `comment_likes` після rebuild = сума `CommentLikeAnalyticsEvent` за день або **0** (без збереження старих помилкових значень у рядку).

---

## 5. POST update (спадщина)

Тіло: `book_id` (число або **slug**), `action_type` з дозволеного списку. Не варто робити це єдиним джерелом правди — можливі дублікати та накрутка; основний шлях — події з п. 4.

---

## 6. Celery: перерахунок і очищення

- **`repair_analytics_from_sources`** — синхронізація `BookAnalytics` і `DailyAnalytics` з таблиць-моделей і журналу подій (див. `rebuild.py`).
- **`cleanup_old_analytics`** — видаляє `DailyAnalytics` та `CommentLikeAnalyticsEvent` старші за 90 днів.

Розклад у **`FanVers_project/celery.py`** (`beat_schedule`): `repair_analytics_from_sources` (02:30 UTC), `cleanup_old_analytics` (03:00 UTC). У поточному **`settings.py` немає** `CELERY_BEAT_SCHEDULER = DatabaseScheduler` — beat читає розклад з коду. Міграції `analytics_books` і `django_celery_beat` можуть історично додавати записи в БД; орієнтуйтеся на **`celery.py`**. Час у crontab — **UTC**.

---

## 7. Зв’язок з іншою документацією

- **COMMENTS_BACKEND.md**, **RATINGS_BACKEND.md**, **SORT_BY_NAVIGATION_BACKEND.md** — згадки викликів аналітики.
- **DEPLOYMENT_PRODUCTION.md** — worker + beat.
- **LISTS_AND_CAROUSELS_BACKEND.md** — HTTP-видача ТОПу та інших списків для каруселей.

---

**Останнє оновлення:** 2026-05-24 (зв'язок з UserChapterProgress — 2026-05-24; узгоджено з ТОПом; перейменування з «трендів» — 2026-03-21)
