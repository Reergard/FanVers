# Рейтинги на Frontend (Рейтинг твору + Якість перекладу)

Документ описує **повний цикл роботи рейтингів** на сторінці книги: які файли залучені, логіка від натискання зірки до збереження та відображення даних, перевірки, обробка помилок і зв’язки з API.

---

## 1. Огляд

Користувач на сторінці книги (`/books/:slug`) бачить два блоки рейтингу:

- **РЕЙТИНГ ТВОРУ** — оцінка твору (1–5 зірок).
- **ЯКІСТЬ ПЕРЕКЛАДУ** — оцінка якості перекладу (1–5 зірок).

Для кожного блоку: завантажуються середня оцінка, кількість голосів і (для авторизованого користувача) власна оцінка. Користувач може натиснути зірку, щоб поставити або змінити оцінку. Гості бачать рейтинги і можуть наводити курсор (передперегляд), але при кліку отримують попередження про необхідність авторизації.

---

## 2. Файли та відповідальність

| Файл | Призначення |
|------|-------------|
| **api/endpoints.ts** | URL рейтингів: `ratingBookRatings(bookSlug)`, `ratingSubmit`. |
| **api/ratingApi.ts** | Типи, `fetchBookRatings(bookSlug)`, `submitRating(bookSlug, ratingType, rating)`, нормалізація відповіді API. |
| **api/http.ts** | Загальний Axios-клієнт: підставляє `Authorization: Bearer`, при 401 — refresh і retry. |
| **shared/utils/requestThrottle.ts** | Обмеження частоти запитів (throttling) і single-flight по ключу для submit. |
| **catalog/sections/BookHero.tsx** | Точка входу рейтингів: `useQuery` за рейтингами по `bookSlug`, формує пропси для двох блоків, invalidate після успішного голосування. |
| **catalog/sections/BookRatingStars.tsx** | Один блок рейтингу: 5 зірок, три стани (сірий / середній жовтий / яскравий жовтий), hover, клік → submit через throttle, обробка помилок. |
| **catalog/styles/BookDetail.module.css** | Стилі: `.ratingsStack`, `.ratingBox`, `.ratingTitle`, `.ratingStars`, `.ratingHint`, `.ratingStarBtn`, `.ratingStarEmpty`, `.ratingStarAverage`, `.ratingStarFilled`. |
| **catalog/BookDetailOwner.tsx** | Передає в `BookHero` проп `bookSlug={book.slug}`. |
| **catalog/BookDetailReader.tsx** | Передає в `BookHero` проп `bookSlug={book.slug}`. |
| **auth/useAuth.ts** | Хук: `isAuthenticated` для дозволу голосування та курсора. |
| **shared/NotificationModal/NotificationProvider.tsx** | `useNotification()`: `showError`, `showWarning` для зворотного зв’язку. |

---

## 3. Потік даних: від відкриття сторінки до відображення рейтингів

```
BookDetailRouter (slug з URL)
       │
       ▼
BookDetailOwner | BookDetailReader
       │  book.slug
       ▼
BookHero(bookSlug={book.slug})
       │
       ├── slugForRatings = (bookSlug && String(bookSlug).trim()) || ""
       ├── useQuery({ queryKey: ["book-ratings", slugForRatings], queryFn: () => fetchBookRatings(slugForRatings), enabled: Boolean(slugForRatings) })
       │         │
       │         ▼
       │   GET /api/rating/{slug}/book-ratings/  (api/http.ts, Bearer якщо є)
       │         │
       │         ▼
       │   ratingApi.fetchBookRatings(slug) → normalizeRatingsResponse(data)
       │
       ├── ratingsData = ratingsQuery.data
       ├── bookRating, translationRating, userRatings з ratingsData (з fallback 0 / null)
       │
       └── slugForRatings ? <BookRatingStars ... /> x2 (BOOK, TRANSLATION) : заглушки
```

- Якщо `bookSlug` не передано або порожній після trim — запит не виконується (`enabled: false`), показуються статичні заглушки.
- Один GET повертає і рейтинг твору, і рейтинг перекладу, і оцінки поточного користувача; дані нормалізуються в `ratingApi` і передаються в два екземпляри `BookRatingStars`.

---

## 4. Потік даних: натискання зірки → збереження → оновлення UI

```
Користувач клікає зірку (1–5)
       │
       ▼
BookRatingStars.handleStarClick(selectedRating)
       │
       ├── Перевірка: !isAuthenticated → showWarning("Для голосування необхідно увійти в систему"), return
       ├── value = clamp 1–5 (Math.min(5, Math.max(1, Math.floor(selectedRating))))
       ├── setSubmitting(true)
       ├── key = createRequestKey(bookSlug, ratingType, "submit")  // "submit_{slug}_{BOOK|TRANSLATION}"
       │
       ▼
requestThrottle.addRequest(key, () => submitRating(bookSlug, ratingType, value))
       │
       ├── Якщо вже є pending запит з таким key → повертається той самий Promise (single-flight)
       ├── Якщо throttle (інтервал < 100 ms або ≥ 30 запитів/хв) → setTimeout(100 ms) і знову addRequest
       ├── Інакше: виконується requestFn()
       │
       ▼
ratingApi.submitRating(bookSlug, ratingType, value)
       │
       ├── Валідація: slug trim і не порожній, ratingType in ['BOOK','TRANSLATION'], value 1–5
       ├── POST /api/rating/  { book_slug, rating_type, rating }  (api/http.ts, Bearer + CSRF)
       │
       ▼
Успіх (201):
       │
       ├── onRatingSuccess() → queryClient.invalidateQueries({ queryKey: ["book-ratings", slugForRatings] })
       ├── React Query робить refetch GET /api/rating/{slug}/book-ratings/
       ├── BookHero отримує нові ratingsData, передає оновлені average/totalVotes/userRating в BookRatingStars
       └── setSubmitting(false) (у finally)

Помилка (4xx/5xx або мережа):
       │
       ├── catch: витягується status, data.error / data.detail / data.rating[0]
       ├── 429 → showError("Забагато спроб...")
       ├── інакше → showError(msg або "Помилка при голосуванні")
       └── setSubmitting(false) (у finally)
```

Після успішного submit кеш рейтингів інвалідується, дані підтягуються одним GET і обидва блоки (РЕЙТИНГ ТВОРУ та ЯКІСТЬ ПЕРЕКЛАДУ) оновлюються з новими `average`, `total_votes` і `user_ratings`.

---

## 5. API та контракт даних

### Ендпоінти (api/endpoints.ts)

- **Отримання рейтингів:** `GET /api/rating/{bookSlug}/book-ratings/`  
  - Реалізація: `API.ratingBookRatings(bookSlug)` з `encodeURIComponent(bookSlug)`.
- **Відправка оцінки:** `POST /api/rating/`  
  - Реалізація: `API.ratingSubmit`.

### Типи та нормалізація (api/ratingApi.ts)

- **BookRatingsResponse:**  
  `book_rating: { average, total_votes }`, `translation_rating: { average, total_votes }`, `user_ratings: Array<{ rating_type, rating }> | null`.
- **normalizeRatingsResponse(raw):**  
  Приводить будь-яку відповідь до цього контракту: `average` у діапазоні 0–5, `total_votes` ≥ 0, елементи `user_ratings` тільки з `rating` 1–5; при невалідному `raw` повертається структура з нулями та `user_ratings: null`.
- **fetchBookRatings(bookSlug):**  
  Якщо slug порожній або не рядок — повертає результат `normalizeRatingsResponse(null)` без запиту. Інакше — GET і нормалізація відповіді.
- **submitRating(bookSlug, ratingType, rating):**  
  Перевіряє slug (trim, не порожній), `ratingType` (BOOK | TRANSLATION), клоп `rating` 1–5; кидає помилку при невалідних даних.

Всі запити йдуть через `http.ts` (Bearer, при 401 — refresh і retry).

---

## 6. Логіка відображення зірок (BookRatingStars)

Кожна зірка (1–5) має один із трьох станів:

| Стан | CSS клас | Умова |
|------|----------|--------|
| **filled** (яскравий жовтий) | `ratingStarFilled` | hover ≥ номер зірки **або** оцінка користувача ≥ номер зірки |
| **average** (середній жовтий) | `ratingStarAverage` | інакше, якщо `Math.round(average) ≥ номер зірки` |
| **empty** (сірий) | `ratingStarEmpty` | інакше |

- **hover** — локальний стан `hoverRating` (1–5 або 0 при mouseLeave).
- **Оцінка користувача** — `userRating` з пропсів (з API `user_ratings`); перевірка `userRating != null && ...`.
- **Загальний рейтинг** — для кольору «середній жовтий» використовується округлене середнє (`Math.round(average)`), щоб після власної оцінки (наприклад 2) при загальному 4 залишались 3-тя і 4-та зірки кольору рейтингу, 5-та — сіра.

Граничні значення (NaN, поза 0–5) обрізаються; для відображення підказки голосів використовуються `Number(average).toFixed(1)` і `Math.max(0, Math.floor(Number(totalVotes)))`.

---

## 7. Перевірки та обмеження

- **Авторизація:** Голосування дозволене лише при `useAuth().isAuthenticated`; інакше — попередження через `showWarning`. Зірки не disabled для гостей (hover і перегляд рейтингу працюють), але клік не викликає submit.
- **Slug:** У `BookHero` використовується нормалізований `slugForRatings` (trim); запит і invalidate виконуються тільки при непустому `slugForRatings`.
- **Throttle (requestThrottle.ts):** Мінімальний інтервал 100 ms, максимум 30 запитів на хвилину по ключу; для одного ключа одночасно виконується лише один запит (single-flight). Ключ submit: `submit_{bookSlug}_{ratingType}`.
- **React Query:** Ключ `["book-ratings", slugForRatings]`, `staleTime: 60_000`, `retry: 1`, `enabled: Boolean(slugForRatings)`.

---

## 8. Обробка помилок

- **submitRating:**  
  Помилки axios (4xx/5xx, мережа) потрапляють у `catch` у `handleStarClick`. Текст повідомлення береться з `response.data.error`, `response.data.detail` або першого елемента `response.data.rating`; для 429 показується окремий текст про забагато спроб. У будь-якому випадку викликається `showError(...)`, потім `setSubmitting(false)`.
- **fetchBookRatings:**  
  Помилки (наприклад 404) призводять до `isError` у React Query; компонент отримує `ratingsData === undefined` і використовує fallback (нулі, null для user_ratings), тобто відображаються порожні рейтинги без падіння UI.

---

## 9. Зв’язок з аналітикою та ТОПом (бекенд)

Перша оцінка користувача даного типу (BOOK або TRANSLATION) для книги на бекенді збільшує лічильники аналітики; **зміна вже існуючої зірки** (той самий тип) не додає другий «голос» у зважених метриках ТОПу. Видалення оцінки зменшує лічильник. Окремий виклик analytics API з фронту для цього не потрібен. Деталі: `backend/docs/ANALYTICS_BOOKS_BACKEND.md`.

---

## 10. Зв’язок з іншими документами

- Завантаження сторінки книги та передача `book`/`slug`: [BOOK_PAGE_DATA_FLOW.md](./BOOK_PAGE_DATA_FLOW.md).
- Відповідність блоків сторінки книги даним: [BOOK_PAGE_DESIGN_DATA_FLOW.md](./BOOK_PAGE_DESIGN_DATA_FLOW.md).
- Авторизація та `useAuth`: [AUTHENTICATION_FRONTEND.md](./AUTHENTICATION_FRONTEND.md).
- Глобальні сповіщення: [NOTIFICATIONS_FRONTEND.md](./NOTIFICATIONS_FRONTEND.md).

---

**Останнє оновлення:** 2026-03-21
