# Картки книг — повна документація

Документ описує **картки книг** у проєкті FanVers: де знаходяться файли, як працює компонент, які є варіанти, на яких сторінках вони використовуються та як вибирається потрібний варіант.

---

## 1. Єдине джерело

У проєкті існує **один компонент** для всіх карток книг — `BookCard`. Інших компонентів карток книг немає. Усі сторінки імпортують його з `../BookCard/BookCard` і передають потрібний `variant`.

---

## 2. Основні файли

| Файл | Призначення |
|------|-------------|
| `frontend/src/BookCard/BookCard.tsx` | Логіка компонента, рендер залежно від variant |
| `frontend/src/BookCard/BookCardTitle.tsx` | Спільний заголовок: ellipsis або бегуча строка (marquee) |
| `frontend/src/BookCard/BookCard.css` | Усі стилі картки (базові + варіанти default, withTags, bookmark, ad, carousel) |

### Залежності BookCard

- `api/catalogApi.ts` — типи `Book`, `UserTranslationBook`
- `bookmarks/types.ts` — тип `BookmarkBook`
- `shared/bookCover/resolveBookCoverUrl.ts` — формування URL обкладинки
- `shared/ActionButton/ActionButton.tsx` — кнопка «Читати»
- `shared/Icon.tsx` — іконка закладки (variant bookmark)
- `shared/Modal/Modal.tsx` — модалка розгортання тегів (variant withTags)
- `assets/backgrounds/18+small.svg`, `18+.svg` — бейджі 18+
- `assets/backgrounds/Ellipse_for_book.svg` — еліпс для variant ad
- `assets/backgrounds/line__smoll_book.svg` — вертикальна лінія на обкладинці
- `shared/hooks/useMedia.ts` — адаптивна обрізка опису в `variant="ad"` (через `BookCard.tsx`)

### Заголовок (`BookCardTitle`)

Усі варіанти використовують **`BookCardTitle`** замість сирого `<h3>`:

- якщо текст **вміщується** — `text-overflow: ellipsis` (одна строка);
- якщо **не вміщується** — CSS-marquee з дубльованим текстом (клон з `aria-hidden`);
- `ResizeObserver` перераховує overflow при зміні ширини;
- при `prefers-reduced-motion: reduce` marquee **вимкнено** (лише ellipsis);
- пауза marquee при `:hover` на viewport заголовка.

Класи: `.bookCard__titleViewport`, `.bookCard__titleTrack`, `.bookCard__titleText`; модифікатор `--marquee`.

---

## 3. Принцип роботи

### Props

```ts
type Props = {
  book: BookCardBook;           // Book | UserTranslationBook | BookmarkBook
  variant?: "default" | "withTags" | "bookmark" | "ad" | "carousel";
  description?: string;         // Тільки для variant="ad"
};
```

### Вибір варіанта

Компонент перевіряє `variant` і рендерить **різну розмітку**:

1. **`variant="bookmark"`** — окремий JSX
2. **`variant="carousel"`** — обкладинка + назва (карусель «Інші роботи автора»), обгортка `Link`
3. **`variant="ad"`** — еліпс, опис, кнопка «читати»
4. **`variant="default"`** / **`variant="withTags"`** — спільна розмітка з `.bookCard__meta`

### Обгортка посиланням

- **bookmark:** компонент повертає `<article>`; Link додає `BookmarksPage`.
- **carousel, ad:** компонент обгортає картку в `<Link to={/books/${slug}}>` (якщо є slug).
- **default, withTags:** Link на всю картку або `bookCard-no-link`.

### Навігація

- **bookmark:** кнопка «читати» → `navigate`.
- **ad:** декоративна кнопка «читати»; перехід — клік по `Link`.
- **carousel:** лише клік по картці (`Link`); drag каруселі блокує випадковий клік (див. **LISTS_AND_CAROUSELS_FRONTEND.md**).
- **default, withTags:** Link на всю картку; кнопка «Читати» у withTags — `ActionButton to=...`.

---

## 4. Варіанти (variants)

### 4.1. default

**Де використовується:** Каталог, Власні переклади, Чарівний Гід (`MagicalGuide3` — ТОП з API, `MagicalGuide1`/`MagicalGuide2` — тренди/рекомендації поки заглушки; див. **LISTS_AND_CAROUSELS_FRONTEND.md**).

**Що показує:**
- Обкладинка (з vertical line зліва, NEW, 18+, декоративна «A»)
- Назва книги
- Мета: дата створення, дата останньої активності, перегляди за день, дохід за день, дохід за місяць

**Класи:** `bookCard` (без модифікатора).

**Стилі:** базові в `BookCard.css`; для `.catalog-page .bookCard` і `.bookCard-mobile-grid .bookCard` — перевизначення ширини обкладинки та мобільна сітка.

---

### 4.2. withTags

**Де використовується:** Покинуті переклади, Пошук.

**Що показує:**
- Обкладинка (як у default)
- Назва книги
- Мета: фендоми, теги, жанри (по 2, з кнопкою «більше» → модалка)
- Статус перекладу
- Кнопка «Читати»

**Класи:** `bookCard bookCard--withTags`.

**Стилі:** окремі правила для `.bookCard--withTags`; на мобільній — grid-розкладка (обкладинка зліва, мета справа).

**Модалка:** при кліку на «більше» відкривається `Modal` з повним списком фендомів/тегів/жанрів.

---

### 4.3. bookmark

**Де використовується:** Закладки (`/bookmarks`).

**Що показує:**
- Обкладинка (без vertical line на desktop; на мобільній — з лінією)
- Бейдж NEW, 18+ (у круглому wrap), іконка закладки (desktop), декоративна «A»
- Назва книги з лінією під нею
- Кнопка «читати» (86×26 px)

**Класи:** `bookCard bookCard--bookmark`, `bookCard__cover--bookmark`, `bookCard__title--bookmark`.

**Особливості:**
- Фон картки: `rgba(12, 20, 26, 0.4)`, border-radius
- На мобільній іконка закладки прихована
- Картка не обгортається в Link — це робить BookmarksPage
- На сторінці Закладок чергування градієнта: `.cardWithGradient article` отримує `background: linear-gradient(20deg, #050d11 0%, #05b4c7 100%)`

---

### 4.4. ad

**Де використовується:** Реклама на головній, в каталозі та пошуку (`AdvertisingCarousel` у `website_advertising/AdvertisingBooks.tsx` → `BookScrollerCarousel`).

**Що показує:**
- Декоративний еліпс на фоні (через `::before` і CSS-змінну `--ellipse-bg`)
- Обкладинка з vertical line зліва
- 18+ (без круглого wrap, менший розмір)
- Декоративна «A»
- Назва книги з лінією під нею
- Опис (prop `description`, до 6 рядків)
- Кнопка «читати» (86×26 px)

**Класи:** `bookCard bookCard--ad`, `bookCard__cover--ad`, `bookCard__title--ad`.

**Особливості:**
- Мінімальна висота картки: 468px
- Еліпс задається inline-style: `--ellipse-bg: url(...Ellipse_for_book.svg)`

### 4.5. carousel

**Де використовується:** карусель **«ІНШІ РОБОТИ АВТОРА»** на сторінці книги (`catalog/sections/AuthorWorks.tsx` → `BookScrollerCarousel`).

**Що показує:**
- Еліпс на фоні (як у `ad`)
- Обкладинка з vertical line, NEW, 18+, «A»
- Декоративна лінія **над** назвою
- Назва книги (без опису й кнопки)

**Класи:** `bookCard bookCard--carousel`, `bookCard__cover--carousel`, `bookCard__title--carousel`.

**Особливості:**
- Обгортка `<Link>`; `draggable={false}` на `<img>` обкладинки
- Бейджі: та сама логіка, що в інших варіантах (`adult_content` → 18+; `book_type === "AUTHOR"` → «A»; `is_new_badge` / `created_at` → NEW)

---

## 5. Сторінки та варіанти

| Сторінка / Компонент | Маршрут | Variant | Файл |
|----------------------|---------|---------|------|
| Каталог | `/catalog` | default | `catalog/Catalog.tsx` |
| Власні переклади | `/my-translations` | default | `users/UserTranslations.tsx` |
| Покинуті переклади | `/abandoned` | withTags | `catalog/AbandonedTranslations.tsx` |
| Пошук | `/search` | withTags | `search/search.tsx` |
| Головна (НОВИНКИ, ОСТАННІ ОНОВЛЕННЯ) | `/` | default | `main/HomePage2.tsx`, `main/HomePage3.tsx` |
| Чарівний Гід (Тренди / Рекомендації / Топ) | `/MagicalGuide` | default | `main/MagicalGuide1.tsx`, `MagicalGuide2.tsx`, `MagicalGuide3.tsx` |
| Закладки | `/bookmarks` | bookmark | `bookmarks/BookmarksPage.tsx` |
| Реклама (головна, каталог, пошук) | `/`, `/catalog`, `/search` | ad | `website_advertising/AdvertisingCarousel` |
| Інші роботи автора | `/books/:slug` | carousel | `catalog/sections/AuthorWorks.tsx` |

---

## 6. Стилі сторінок, що впливають на картки

Картки отримують додаткові стилі з CSS сторінок:

### 6.1. Catalog

- `Catalog.css`: `.catalog-page__grid` (4 колонки, адаптивно 3→2), `.catalog-page__cell` (градієнтний фон під карткою)
- `BookCard.css`: `.catalog-page .bookCard` — `--cover-w: clamp(160px, 15vw, 210px)`; на мобільній — інша ширина

### 6.2. Власні переклади

- `UserTranslations.module.css`: сітка `.cardCell`
- Секція має клас `bookCard-mobile-grid` — застосовуються мобільні правила з `BookCard.css` (grid для default)

### 6.3. Покинуті переклади та Пошук

- `AbandonedTranslations.css`: `.abandoned-grid`, `.abandoned-card-cell`, `.abandoned-card-surface` (фон, тінь, чергування градієнтів для парних/непарних)
- `search.css` імпортує `AbandonedTranslations.css` — ті самі стилі для результатів пошуку
- Картка обгортається в `abandoned-card-surface`

### 6.4. Закладки

- `BookmarksPage.module.css`: `.grid` (3 колонки, на планшеті 2, на мобільній 2), `.cardWithGradient article` (градієнт для чергових карток), `.cardLink`, `.cardNoLink`

### 6.5. Реклама та каруселі книг

- `shared/carousel/BookScrollerCarousel.module.css` — `--per-view`, навігація, вирівнювання кнопки «ЧИТАТИ» в ряді `bookCard--ad`
- `catalog/styles/BookDetail.module.css` — `.authorWorksCarousel` для сторінки книги
- Автопрокрутка реклами (5 с, пауза при наведенні) — **LISTS_AND_CAROUSELS_FRONTEND.md** §1.5

### 6.6. Чарівний Гід

- `MagicalGuide.css`: `.mg2-cardShell` (обгортка картки), `.mg2-section .book-card` — селектори для ширини обкладинки та приховування мета-блоку.  
  **Примітка:** BookCard використовує клас `bookCard`, а не `book-card`; селектори `.book-card` у MagicalGuide.css можуть не збігатися з поточною розміткою.

---

## 7. Типи даних (book)

Компонент приймає `BookCardBook = Book | UserTranslationBook | BookmarkBook`.

**Мінімальні поля:**
- `id`, `slug?`, `title`, `image?`, `adult_content?`

**Для default** (`/my-translations`, `UserTranslationBook`): `created_at`, `last_updated`, `daily_views`, `daily_income`, `monthly_income`, `total_readers`, `completed_readers` — джерело `GET /api/catalog/user-translations/` (**READING_PROGRESS_FRONTEND.md** §6).

**Для withTags:** потрібні `fandoms`, `tags`, `genres`, `translation_status_display`.

**Для ad:** prop `description`.

**Для carousel:** достатньо полів обкладинки (`image`, `adult_content`, `book_type`, `is_new_badge`, `slug`, `title`).

---

## 8. Адаптивність

- **default, withTags:** на екрані ≤768px застосовується grid (назва зверху, обкладинка зліва, мета справа). Для Catalog і UserTranslations — селектор `.catalog-page .bookCard:not(.bookCard--withTags)`, `.bookCard-mobile-grid .bookCard:not(.bookCard--withTags)`.
- **withTags:** на мобільній — окремий grid з areas для title, cover, meta, status, button.
- **bookmark:** на мобільній — vertical line на обкладинці, іконка закладки прихована, інші розміри.
- **ad:** адаптивність через `BookScrollerCarousel`.
- **carousel:** компактна картка; ширина обкладинки в `BookCard.css` §4.5.

---

## 9. Швидка довідка

| Питання | Відповідь |
|---------|-----------|
| Де компонент? | `BookCard/BookCard.tsx` |
| Де стилі? | `BookCard/BookCard.css` (+ marquee в §`.bookCard__titleViewport`) |
| Де заголовок? | `BookCard/BookCardTitle.tsx` (усі variants) |
| Як вибрати варіант? | `variant="default" \| "withTags" \| "bookmark" \| "ad" \| "carousel"` |
| Потрібен опис? | Тільки для `variant="ad"` |
| Хто обгортає в Link? | `carousel`, `ad`, `default`, `withTags` — сам BookCard; `bookmark` — BookmarksPage |
| Є інші компоненти карток? | Ні, тільки BookCard |

---

*Останнє оновлення: 2026-06-28 (`BookCardTitle`, marquee назв, інтеграція з каруселями).*
