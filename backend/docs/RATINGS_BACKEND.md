# Рейтинги на Backend (Рейтинг твору + Якість перекладу)

Документ описує **реалізацію рейтингів** у бекенді: моделі, API, валідацію, права доступу, збереження та повернення даних.

---

## 1. Огляд

Підтримуються два типи рейтингу для книги:

- **BOOK** — рейтинг твору (1–5 зірок).
- **TRANSLATION** — якість перекладу (1–5 зірок).

Користувач може мати лише одну оцінку кожного типу на книгу; повторна відправка оновлює існуючий запис. Читання рейтингів (середнє, кількість голосів, оцінки поточного користувача) доступне всім; створення/оновлення оцінки — лише авторизованим користувачам з дозволом на оцінювання книги (згідно з налаштуваннями книги `rate_permission`).

---

## 2. Файли та відповідальність

| Файл | Призначення |
|------|-------------|
| **apps/rating/models.py** | Модель `BookRating`: книга, користувач, тип рейтингу, значення 1–5, unique_together (book, user, rating_type). |
| **apps/rating/api/serializers.py** | `BookRatingSerializer`: валідація `rating_type` (BOOK/TRANSLATION), `rating` (1–5), перетворення `book_slug` → book, create-or-update при повторному голосуванні. |
| **apps/rating/api/views.py** | `BookRatingViewSet`: права (AllowAny для читання, IsAuthenticated для create), `book_ratings` (GET статистики), `create` (POST оцінки з перевіркою доступу). |
| **apps/rating/api/urls.py** | Маршрутизація: реєстрація ViewSet, URL префікс `/api/rating/`. |
| **apps/catalog/api/permissions.py** | `check_book_access_permission(user, book, 'rate')`: перевірка `rate_permission` (all / bookmarked / none) для дозволу оцінювання. |
| **apps/catalog/models.py** | Модель `Book`: поле `rate_permission` (або еквівалент), зв’язок з рейтингами. |
| **apps/api/urls.py** | Підключення: `path('rating/', include('apps.rating.api.urls'))`. |

---

## 3. Модель даних

**BookRating** (apps/rating/models.py):

| Поле | Тип | Опис |
|------|-----|------|
| book | ForeignKey(Book, CASCADE, related_name='ratings') | Книга |
| user | ForeignKey(User, CASCADE) | Користувач |
| rating_type | CharField(max_length=20, choices=RATING_TYPES) | 'BOOK' або 'TRANSLATION' |
| rating | IntegerField(choices=1..5) | Оцінка 1–5 |
| created_at | DateTimeField(auto_now_add=True) | Час створення |

**Meta:** `unique_together = ('book', 'user', 'rating_type')` — один запис на пару (книга, користувач, тип).

---

## 4. API ендпоінти

Базовий префікс: **/api/rating/** (з кореневих url проекту).

### 4.1. Отримання рейтингів книги

- **Метод і URL:** `GET /api/rating/<book_slug>/book-ratings/`
- **Права:** AllowAny (гості можуть читати).
- **Призначення:** Повернути агреговану статистику по книзі та оцінки поточного користувача (якщо авторизований).

**Відповідь (200):**

```json
{
  "book_rating": {
    "average": 4.2,
    "total_votes": 15
  },
  "translation_rating": {
    "average": 3.8,
    "total_votes": 12
  },
  "user_ratings": [
    { "rating_type": "BOOK", "rating": 5 },
    { "rating_type": "TRANSLATION", "rating": 4 }
  ]
}
```

- `user_ratings` — `null`, якщо користувач не авторизований; інакше список об’єктів з полями `rating_type` та `rating`.
- `average` — середнє арифметичне оцінок (при відсутності голосів повертається 0).
- `total_votes` — кількість записів рейтингу відповідного типу.

**Помилки:**

- 400 — відсутній або порожній `book_slug` (у URL або query).
- 404 — книга з таким slug не знайдена (`get_object_or_404(Book, slug=book_slug)`).

### 4.2. Надсилання або оновлення оцінки

- **Метод і URL:** `POST /api/rating/`
- **Права:** IsAuthenticated.
- **Тіло запиту:**

```json
{
  "book_slug": "my-book-slug",
  "rating_type": "BOOK",
  "rating": 4
}
```

- **Призначення:** Зберегти або оновити оцінку поточного користувача для вказаної книги та типу. Якщо запис вже існує (за unique_together) — оновлюється поле `rating`.

**Відповідь:**

- 201 Created — повертаються дані створеного/оновленого об’єкта (serializer.data).
- 400 — невалідні дані (відсутній slug, невірний rating_type або rating не 1–5, книга не знайдена в serializer).
- 403 — користувач не має права оцінювати цю книгу (перевірка `check_book_access_permission(..., 'rate')`).
- 404 — книга не знайдена за `book_slug` при перевірці доступу (`get_object_or_404(Book, slug=book_slug)`).

---

## 5. Логіка роботи: GET book_ratings

1. Отримання `book_slug` з URL (або з query params).
2. Якщо slug порожній — `Response({'error': 'Book slug is required'}, 400)`.
3. `book = get_object_or_404(Book, slug=book_slug)` — при відсутності книги DRF поверне 404 (після re-raise Http404).
4. Вибірка всіх рейтингів книги: `BookRating.objects.filter(book=book)`.
5. Агрегація для BOOK: `filter(rating_type='BOOK').aggregate(avg_rating=Avg('rating'), total_votes=Count('id'))`.
6. Агрегація для TRANSLATION: аналогічно з `rating_type='TRANSLATION'`.
7. Якщо користувач авторизований — `ratings.filter(user=request.user).values('rating_type', 'rating')` → `user_ratings` (список словників); інакше `user_ratings: None`.
8. Формування відповіді з `average` (0 при `avg_rating is None`) та `total_votes`.
9. При будь-якому іншому виключенні (крім Http404) — 400 з текстом помилки.

---

## 6. Логіка роботи: POST create (відправка оцінки)

1. З тіла запиту береться `book_slug`.
2. Якщо `book_slug` передано — знаходиться книга `get_object_or_404(Book, slug=book_slug)`; викликається `check_book_access_permission(request.user, book, 'rate')`. Якщо доступ заборонено — `Response({'error': error_message}, 403)`.
3. Валідація даних через `BookRatingSerializer`: обов’язкові поля `book_slug`, `rating_type`, `rating`; `user` підставляється з `request.user` (CurrentUserDefault).
4. У serializer:
   - **validate_rating_type:** лише 'BOOK' або 'TRANSLATION'.
   - **validate_rating:** ціле число від 1 до 5.
   - **create:** за `book_slug` знаходиться книга; перевіряється наявність запису `BookRating` для (book, user, rating_type). Якщо є — оновлюється `rating` і повертається існуючий об’єкт; інакше створюється новий запис. При відсутності книги — `ValidationError` по полю `book_slug`.
5. Успішний результат — 201 і дані об’єкта рейтингу.
6. Http404 (книга не знайдена при перевірці доступу) — пробрасывается далі (404 відповідь).
7. Інші виключення — 400 з текстом помилки.

---

## 7. Права доступу до оцінювання (rate_permission)

Функція **check_book_access_permission(user, book, 'rate')** (apps/catalog/api/permissions.py):

- Якщо користувач не авторизований — `(False, "Необхідна авторизація")`.
- Власник книги завжди має доступ — `(True, None)`.
- Інакше читається атрибут книги `rate_permission` (поле типу 'all' | 'bookmarked' | 'none' або аналог):
  - **'none'** — `(False, "Доступ заборонено власником книги")`.
  - **'bookmarked'** — перевірка наявності запису в Bookmark для (user, book); якщо закладки немає — `(False, "Доступ тільки для користувачів, у яких книга в закладках")`.
  - **'all'** (або еквівалент) — `(True, None)`.

Повідомлення з кортежа повертається клієнту в тілі 403 як `{'error': error_message}`.

---

## 8. Маршрутизація (apps/rating/api/urls.py)

- Використовується `DefaultRouter`, реєстрація ViewSet з префіксом `r''` та `basename='rating'`.
- Підключення в кореневому url: `path('rating/', include('apps.rating.api.urls'))`.

Результат:

- Список (для ViewSet): `GET /api/rating/`
- Створення: `POST /api/rating/`
- Custom action: `GET /api/rating/<book_slug>/book-ratings/` (url_path з regex для `book_slug`).

Точний формат URL залежить від trailing slash у налаштуваннях Django (наприклад, `/api/rating/<slug>/book-ratings/`).

---

## 9. Аналітика та ТОП (зв’язок з `analytics_books`)

- У **`BookRatingSerializer.create`**: якщо для пари (книга, користувач, `rating_type`) запису **ще не було** і створюється новий — викликається **`record_book_rating_created`** або **`record_translation_rating_created`** (оновлюються **BookAnalytics** / поточний день **DailyAnalytics**). Якщо запис уже існував — лише оновлюється значення `rating`, **лічильник голосів у аналітиці не змінюється** (щоб не рахувати зміну думки як новий голос).
- У **`perform_destroy`** view — **`record_book_rating_removed`** / **`record_translation_rating_removed`**.

Повна картина: **ANALYTICS_BOOKS_BACKEND.md**.

---

## 10. Зв’язки з іншими модулями

- **catalog.Book:** модель книги; має поле доступу для оцінювання (`rate_permission` або аналог); рейтинги з `related_name='ratings'`.
- **catalog.api.permissions:** використовується лише для перевірки доступу при створенні оцінки (create), не для GET book_ratings.
- **users (auth):** `request.user` для IsAuthenticated і для підстановки user у serializer; у book_ratings — визначення `user_ratings` для авторизованого користувача.
- **navigation.Bookmark:** використовується при `rate_permission == 'bookmarked'` у `check_book_access_permission`.

---

## 11. Можливі помилки та відповіді

| Ситуація | Код | Тіло (приклад) |
|----------|-----|-----------------|
| Книга не знайдена (GET book_ratings) | 404 | — |
| Книга не знайдена (POST create, при перевірці доступу) | 404 | — |
| Відсутній/порожній book_slug (GET) | 400 | `{"error": "Book slug is required"}` |
| Немає прав на оцінювання (POST) | 403 | `{"error": "..."}` з текстом з check_book_access_permission |
| Невалідні дані (POST): rating_type або rating | 400 | serializer.errors (наприклад, поля rating_type, rating) |
| Книга не знайдена в serializer create | 400 | `{"book_slug": ["Книгу не знайдено"]}` |
| Неавторизований POST | 401 | — (DRF/IsAuthenticated) |

---

**Останнє оновлення:** 2026-03-21 — зв’язок з аналітикою / ТОПом (**ANALYTICS_BOOKS_BACKEND.md**).
