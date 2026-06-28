# Списки та каруселі (Frontend)

Документ про **горизонтальні каруселі та підбірки книг** у UI: звідки дані, які компоненти, чим відрізняються сценарії.

**Терміни:** **ТОП** — рейтинг за зваженою активністю за періодом (`GET /api/analytics_books/top/`). **Тренди** — майбутній окремий розділ з іншою логікою (зараз у `MagicalGuide1` лише заглушка-текст).

---

## 1. Спільний компонент горизонтальної каруселі

Більшість каруселей з `BookCard` і стрілками/зірками побудовані на **`BookScrollerCarousel`**.

| Файл | Призначення |
|------|-------------|
| `shared/carousel/BookScrollerCarousel.tsx` | Скролер, стрілки, зірки-пагінація, drag мишкою |
| `shared/carousel/BookScrollerCarousel.module.css` | Сітка `--per-view`, overflow, навігація |
| `shared/carousel/carouselUtils.ts` | `getCarouselMetrics`, `getCarouselBehavior` |

### 1.1. Де використовується

| Секція | Обгортка | `BookCard` variant |
|--------|----------|-------------------|
| Реклама (головна, каталог, пошук) | `website_advertising/AdvertisingCarousel` | `ad` |
| **ІНШІ РОБОТИ АВТОРА** (сторінка книги) | `catalog/sections/AuthorWorks` | `carousel` |

`AdvertisingCarousel` лише завантажує дані (React Query) і передає картки в `BookScrollerCarousel`.

### 1.2. Навігація та скрол

- **Стрілки** — прокрутка на одну «сторінку» (`perView` карток за раз).
- **Зірки** — перехід на конкретну сторінку.
- **Сенсор (телефон/планшет)** — нативний горизонтальний свайп (`overflow-x: auto`, `touch-action: pan-x`).
- **Миша (ПК)** — перетягування зажатою ЛКМ по ряду карток (`cursor: grab` / `grabbing`).

### 1.3. Логіка drag мишкою

Реалізація в `BookScrollerCarousel.tsx`:

1. `pointerdown` (лише `pointerType === "mouse"`, ЛКМ) — захоплення pointer, клас `.dragging`.
2. `pointermove` — зміна `scrollLeft`; синхронізація стану навігації.
3. `pointerup` — відпускання; фінальна синхронізація.
4. Якщо був рух (>4 px) — `click` по посиланню картки **блокується** (випадковий перехід на книгу).
5. `dragstart` на зображеннях скасовується (`preventDefault`, `draggable={false}` на обкладинці в `variant="carousel"`, CSS `-webkit-user-drag: none`).

**Стан стрілок** після drag прив’язаний до **реальної позиції скролу** (`scrollLeft` vs `maxScrollLeft`), а не лише до округленого номера сторінки:

- ліва стрілка неактивна, якщо `scrollLeft ≈ 0`;
- права — якщо доскролено до кінця.

Під час drag `scroll-snap-type` тимчасово вимикається (клас `.dragging`).

### 1.4. Адаптив `--per-view`

У `BookScrollerCarousel.module.css` (за замовчуванням):

| Ширина | `--per-view` |
|--------|----------------|
| >1024px | 5 |
| ≤1024px | 3 |
| ≤768px | 2 (у блоці author works на сторінці книги — див. `BookDetail.module.css`) |
| ≤480px | 1 (author works) |

Секція author works перевизначає `--per-view` у `.authorWorksCarousel`.

---

## 2. Сторінка книги — «ІНШІ РОБОТИ АВТОРА»

| Що | Деталі |
|----|--------|
| Компонент | `catalog/sections/AuthorWorks.tsx` |
| Розміщення | `BookDetailLayout` → слот `authorWorks` (після `extraImages`, перед підпискою/розділами) |
| API | `GET /api/catalog/books/<slug>/author-works/` → `catalogApi.getAuthorOtherWorks` |
| Query key | `catalogKeys.authorOtherWorks(slug)` → `["author-other-works", slug]` |
| Картка | `BookCard` `variant="carousel"` — обкладинка (NEW, 18+, «A»), лінія **над** назвою, клік → `/books/:slug` |
| Видимість | Секція **прихована**, якщо завантаження, помилка API або **0 книг** у відповіді |

### 2.1. Логіка відбору книг (бекенд)

- Той самий **`owner`** (власник), що й у поточної книги — **не** `creator`.
- Поточна книга виключається.
- Лише книги з **обкладинкою** і **slug**.
- Для кожної кандидатки — `check_book_access_permission(..., 'view')` (приватні не показуються чужому читачу).
- До **24** книг у відповіді; сканування до **200** кандидатів (`AUTHOR_OTHER_WORKS_SCAN_LIMIT`).

Деталі API: **`backend/docs/LISTS_AND_CAROUSELS_BACKEND.md`** §3.

### 2.2. Пов’язані файли

- `catalog/BookDetailReader.tsx`, `BookDetailOwner.tsx` — `<AuthorWorks bookSlug={book.slug} />`
- `catalog/styles/BookDetail.module.css` — `.authorWorks`, `.authorWorksCarousel`, `.authorWorksNav`
- `BookCard/BookCard.css` — `.bookCard--carousel`

Див. також **BOOK_PAGE_DATA_FLOW.md**, **BOOK_PAGE_DESIGN_DATA_FLOW.md**, **BOOK_CARDS_FRONTEND.md** §4.5.

---

## 3. Головна сторінка (`/`)

| Блок | Файл | Джерело даних | API (бекенд) |
|------|------|---------------|--------------|
| **НОВИНКИ** | `main/HomePage2.tsx` | React Query + `mainApi.getBooksNews()` | `GET /api/main/books-news/` |
| **ОСТАННІ ОНОВЛЕННЯ** | `main/HomePage3.tsx` | `getBooksRecentUpdates()` з `mainApi` | `GET /api/main/books-recent-updates/` |
| **Реклама** | `website_advertising/AdvertisingBooks.tsx` → `AdvertisingCarousel` | `advertisingApi` | Див. **ADVERTISING_STAFF_UA.md** |

**НОВИНКИ** — окрема карусель (`NewsCarouselCover`, свайп/стрілки в `HomePage2`), **не** `BookScrollerCarousel`.

### 3.1. Обрізка опису в каруселях головної

| Блок | Файл | Ліміт UI |
|------|------|----------|
| **НОВИНКИ** | `main/HomePage2.tsx` | **500** символів + `...` |
| **ОСТАННІ ОНОВЛЕННЯ** | `api/mainApi.ts` | **500** символів + `…` |
| **Реклама** | `BookCard` `variant="ad"` | адаптивна обрізка в `BookCard.tsx` |

---

## 4. Сторінка «Чарівний Гід» (`/MagicalGuide`)

| Секція | Компонент | Дані |
|--------|-----------|------|
| **Тренди** (майбутнє) | `MagicalGuide1` | Заглушка |
| **Рекомендації** | `MagicalGuide2` | Локальні заглушки |
| **ТОП** | `MagicalGuide3` | `useTopBooks` → `GET /api/analytics_books/top/?type=...` |

ТОП — **сітка з посторінковими стрілками**, не `BookScrollerCarousel`.

---

## 5. ТОП за періодом

- **GET** `/api/analytics_books/top/?type=day|week|month|all_time`
- Відповідь: `BookReaderSerializer` → `mapTopBook.ts`
- UI: `main/MagicalGuide3.tsx`

---

## 6. Інші списки (не каруселі)

Каталог, пошук, закладки, власні переклади — **STRUCTURE.md**, **BOOK_CARDS_FRONTEND.md**, **SORT_BY_NAVIGATION_FRONTEND.md**.

---

## 7. Пов’язані документи

- Бекенд: **`backend/docs/LISTS_AND_CAROUSELS_BACKEND.md`**
- Картки: **BOOK_CARDS_FRONTEND.md**
- Сторінка книги: **BOOK_PAGE_DATA_FLOW.md**
- Реклама: **ADVERTISING_BOOK_SETTINGS_FLOW.md**

---

**Останнє оновлення:** 2026-06-28 (`BookScrollerCarousel`, «Інші роботи автора», drag мишкою)
