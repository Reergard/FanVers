# Рейтинги книг — інженерний опис (frontend)

Мета: через місяці швидко згадати **як улаштовано UI + API-клієнт**, і не зламати домен при рефакторингу.

---

## 1. Що бачить користувач (і що це означає)

На сторінці книги **два можливі блоки зірок**:

1. **РЕЙТИНГ ТВОРУ** — завжди для книги з slug; тип оцінки на бекенді: **`BOOK`**.
2. **ЯКІСТЬ ПЕРЕКЛАДУ** — **тільки якщо книга в домені — переклад** (`book_type === "TRANSLATION"`). Для **авторської** книги цього блоку **не існує** (не «нуль зірок», а **інший продукт**).

**Неправильно:** «Завжди два рядки рейтингу».

**Правильно:** «Другий рядок показуємо лише коли бекенд дозволяє тип **`TRANSLATION`** для цієї книги».

---

## 2. Ключові файли

| Файл | Роль |
|------|------|
| **`api/endpoints.ts`** | `ratingBookRatings(slug)`, `ratingSubmit`. |
| **`api/ratingApi.ts`** | `fetchBookRatings`, `submitRating`, **`normalizeRatingsResponse`** — єдине місце зведення відповіді API до типів. |
| **`api/http.ts`** | Bearer, 401 refresh. |
| **`shared/utils/requestThrottle.ts`** | throttle + single-flight на submit. |
| **`catalog/sections/BookHero.tsx`** | `useQuery` по `["book-ratings", slug]`, два `BookRatingStars` або один; проп **`bookType`** з каталогу. |
| **`catalog/sections/BookRatingStars.tsx`** | Один блок: кліки → `submitRating`. |
| **`catalog/BookDetailReader.tsx`**, **`BookDetailOwner.tsx`** | `bookSlug`, **`bookType`**, метадані (див. §5). |
| **`catalog/styles/BookDetail.module.css`** | Стилі зірок. |
| **`main/HomePage2.tsx`** | Карусель новин: другий рядок рейтингу приховано для `book_type === "AUTHOR"`. |

---

## 3. Контракт `fetchBookRatings` (після нормалізації)

Тип **`BookRatingsResponse`** (`ratingApi.ts`):

- **`book_rating`** — завжди `{ average, total_votes }`.
- **`translation_rating`** — **`null`**, якщо для цієї книги переклад **не оцінюється** (AUTHOR), або якщо нормалізатор відрізав блок; інакше об’єкт з числами.
- **`has_translation_rating`** — якщо бекенд шле `boolean`, зберігаємо; інакше виводимо з наявності блоку.
- **`overall_rating`**, **`available_rating_types`**, **`book_type`** — з бекенду; використовуйте для відображення/сортування, коли додасте.

**`normalizeRatingsResponse`:**

- Враховує **`has_translation_rating === false`** і **`book_type === "AUTHOR"`**.
- Якщо **`translation_rating: null`** у JSON і книга **не** позначена як `TRANSLATION`, блок перекладу **не** будується з «нулями».

**Не** покладайтеся на те, що `translation_rating` завжди об’єкт — для AUTHOR він **`null`**.

---

## 4. `BookHero`: коли показувати другий блок

Логіка **stack** (скорочено):

- Якщо **`bookType === "AUTHOR"`** → другий блок **ніколи**.
- Якщо **`bookType === "TRANSLATION"`** → другий блок **так** (дані з query).
- Якщо типу ще немає, але є **`ratingsData`**: див. **`has_translation_rating`** і **`translation_rating != null`**.

Потрібен **`bookSlug`** з каталогу; інакше — заглушки без запиту.

У **`SHORT_META_LABELS`** у `BookHero` є і **`Статус перекладу:`**, і **`Статус публікації:`**, щоб рядок метаданих потрапляв у правильну колонку верстки.

---

## 5. Метадані книги (не плутати з рейтингом)

У **`BookDetailReader`** / **`BookDetailOwner`**:

- Для **`book_type === "AUTHOR"`** рядок **не** «Статус перекладу:», а **«Статус публікації:»** (Публічна / Приватна / — за `isPublic`).
- Для **перекладу** залишається **«Статус перекладу:»** з `translation_status_display` і колишнім fallback.

Інакше авторська книга виглядає як переклад у полі статусу — це окремо від рейтингів, але та сама доменна вісь (**AUTHOR vs TRANSLATION**).

---

## 6. Потік submit → оновлення UI

1. `BookRatingStars` → `submitRating(slug, "BOOK" | "TRANSLATION", value)`.
2. Успіх → `onRatingSuccess` → **`queryClient.invalidateQueries({ queryKey: ["book-ratings", slug] })`**.
3. Повторний GET; для AUTHOR другий блок не монтується — **не** викликайте `submitRating` з `TRANSLATION` для авторської книги (бекенд відхилить; UX залежить від того, чи показано кнопки).

**Прогрес читання:** бекенд вимагає хоча б один розділ з `is_read` (окрім власника/творця книги). При відсутності — **403**, поле **`error`** у відповіді; `BookRatingStars` показує текст через `showError`. Збір `is_read` — **READING_PROGRESS_FRONTEND.md**.

---

## 7. Пошук і списки

**Пошук книг** (`SEARCH_FRONTEND.md` / бекенд BookFilter) **окремо**: сортування за «загальним рейтингом якості» у поточному коді **не** зав’язане на цей модуль — не очікуйте автоматичного `overall_rating` у списку, поки не додасте API/анотації.

---

## 8. Що не робити при рефакторингу

- Не повертати «завжди два блоки» без перевірки **`book_type` / відповіді GET**.
- Не трактувати **`translation_rating: null`** як «0 голосів», якщо з бекенду явно **`has_translation_rating: false`** / AUTHOR.
- Не дублювати бізнес-формули `overall_rating` у фронті для «джерела правди» — беріть з API або централізуйте утиліту, синхронну з **`backend/apps/rating/domain.py`**.

---

**Останнє оновлення документа:** 2026-05-24 (обмеження за прогресом читання; домен AUTHOR/TRANSLATION — 2026-03-29).
