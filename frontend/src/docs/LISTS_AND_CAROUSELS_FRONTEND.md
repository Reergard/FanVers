# Списки та каруселі (Frontend)

Документ про **горизонтальні каруселі та підбірки книг** у UI: звідки дані, які компоненти, чим відрізняються сценарії.

**Терміни:** **ТОП** — рейтинг за зваженою активністю за періодом (`GET /api/analytics_books/top/`). **Тренди** — майбутній окремий розділ з іншою логікою (зараз у `MagicalGuide1` лише заглушка-текст).

---

## 1. Спільний компонент горизонтальної каруселі

Більшість каруселей з `BookCard` і стрілками/зірками побудовані на **`BookScrollerCarousel`**.

| Файл | Призначення |
|------|-------------|
| `shared/carousel/BookScrollerCarousel.tsx` | Скролер, стрілки, зірки-пагінація, drag мишкою, опційна автопрокрутка |
| `shared/carousel/BookScrollerCarousel.module.css` | Сітка `--per-view`, overflow, навігація, `carouselFew`, стилі `bookCard--ad` |
| `shared/carousel/carouselUtils.ts` | Метрики, позиції сторінок, `getCarouselNextAutoScrollLeft`, `getCarouselBehavior` |
| `shared/carousel/useCarouselIndexSwipe.ts` | Свайп мишкою для **index-каруселей** (один слайд за раз, без `scrollLeft`) |

### 1.1. Де використовується

| Секція | Обгортка | `BookCard` variant | Автопрокрутка |
|--------|----------|-------------------|---------------|
| Реклама (головна, каталог, пошук) | `website_advertising/AdvertisingCarousel` | `ad` | **Так** (5 с) |
| **ІНШІ РОБОТИ АВТОРА** (сторінка книги) | `catalog/sections/AuthorWorks` | `carousel` | Ні |

`AdvertisingCarousel` лише завантажує дані (React Query) і передає картки в `BookScrollerCarousel` з пропами автопрокрутки.

### 1.2. Навігація та скрол

- **Стрілки** — прокрутка на одну «сторінку» (`perView` карток за раз; остання сторінка — `maxScrollLeft`, не `step × page`).
- **Зірки** — перехід на конкретну сторінку.
- **Сенсор (телефон/планшет)** — нативний горизонтальний свайп (`overflow-x: auto`, `touch-action: pan-x`).
- **Миша (ПК)** — перетягування зажатою ЛКМ по ряду карток (`cursor: grab` / `grabbing`).

### 1.3. Логіка drag мишкою

Реалізація в `BookScrollerCarousel.tsx`:

1. `pointerdown` (лише `pointerType === "mouse"`, ЛКМ; лише якщо є overflow) — захоплення pointer, клас `.dragging`, `isPointerActive` блокує автопрокрутку.
2. `pointermove` — зміна `scrollLeft`; синхронізація стану навігації.
3. `pointerup` — відпускання; фінальна синхронізація; якщо курсор ще над каруселлю — пауза автопрокрутки + idle-таймер.
4. Якщо був рух (>4 px) — `click` по посиланню картки **блокується** (випадковий перехід на книгу).
5. `dragstart` на зображеннях скасовується (`preventDefault`, `draggable={false}` на обкладинці в `variant="carousel"`, CSS `-webkit-user-drag: none`).

**Стан стрілок** після drag прив’язаний до **реальної позиції скролу** (`isCarouselAtStart` / `isCarouselAtEnd` у `carouselUtils.ts`), а не лише до округленого номера сторінки:

- ліва стрілка неактивна на початку;
- права — у кінці списку.

Під час drag `scroll-snap-type` тимчасово вимикається (клас `.dragging`).

### 1.4. Позиції сторінок і «коротка остання сторінка»

У `carouselUtils.ts`:

| Функція | Призначення |
|---------|-------------|
| `getCarouselMetrics` | `perView`, `step`, `maxScrollLeft`, `pagesCount` |
| `getCarouselPage` | Поточна сторінка з `scrollLeft` (кінець = `scrollLeft ≈ maxScrollLeft`) |
| `getCarouselPageScrollLeft` | Цільовий `scrollLeft` для сторінки (остання → `maxScrollLeft`) |
| `getCarouselNextAutoScrollLeft` | Наступна позиція для автопрокрутки |
| `isCarouselAtStart` / `isCarouselAtEnd` | Поріг ~40% ширини однієї картки (snap, subpixel) |

**Важливий кейс:** якщо книг більше, ніж `perView`, але до кінця треба прокрутити менше ніж один повний `step` (наприклад **6 книг / 5 на екрані**), карусель чергує **початок ↔ кінець** (`0 ↔ maxScrollLeft`), а не «застрягає» після першого кроку.

Автопрокрутка вмикається лише коли `maxScrollLeft > 0` (є куди скролити).

### 1.5. Автопрокрутка (лише реклама)

Увімкнена **тільки** в `AdvertisingCarousel` (`AdvertisingBooks.tsx`):

```tsx
<BookScrollerCarousel
  itemCount={books.length}
  autoAdvanceEnabled
  autoAdvanceMs={5000}
  autoAdvanceHoverIdleMs={15000}
>
```

| Проп | Значення | Поведінка |
|------|----------|-----------|
| `autoAdvanceEnabled` | `true` | Увімкнути автопрокрутку |
| `autoAdvanceMs` | `5000` | Інтервал між кроками, мс |
| `autoAdvanceHoverIdleMs` | `15000` | Після наведення: якщо миша не рухається — відновити прокрутку, навіть коли курсор ще над каруселлю |

**Правила:**

| Ситуація | Поведінка |
|----------|-----------|
| Миша **не** над каруселлю | Крок кожні **5 с** без зупинок (циклічно: кінець → початок) |
| **Навели** мишу | Пауза одразу |
| **Прибрали** мишу | Прокрутка відновлюється одразу |
| Навели і **15 с не рухаєте** мишу (поріг руху 4 px) | Пауза знімається; далі знову кожні 5 с |
| Активний drag | Пауза на час перетягування |
| `prefers-reduced-motion: reduce` | Автопрокрутка вимкнена |
| Вкладка прихована (`document.hidden`) | Тики пропускаються |
| Усі книги вміщаються на екрані | Автопрокрутки немає (`maxScrollLeft === 0`) |

Технічно: один постійний `setInterval`; пауза — через ref-флаги (`hoverPauseAutoAdvanceRef`, `isPointerActiveRef`), інтервал не знищується при наведенні. Обгортка `.autoAdvanceRoot` охоплює скролер і навігацію (стрілки, зірки).

### 1.6. Центрування 1–2 книг

Якщо `itemCount ≤ 2` і всі вміщаються без прокрутки (`pagesCount === 1`), до `<ul>` додається клас `carouselFew` — flex по центру, фіксована ширина слота (без розтягування на всю ширину).

### 1.7. Адаптив `--per-view`

У `BookScrollerCarousel.module.css` (за замовчуванням):

| Ширина | `--per-view` |
|--------|----------------|
| >1024px | 5 |
| ≤1024px | 3 |
| ≤768px | 2 (у блоці author works на сторінці книги — див. `BookDetail.module.css`) |
| ≤480px | 1 (author works) |

Секція author works перевизначає `--per-view` у `.authorWorksCarousel`.

### 1.8. Стилі рекламних карток у каруселі

У `BookScrollerCarousel.module.css` для `bookCard--ad` у контексті каруселі:

- однакова `min-height` карток на десктопі;
- `grid-template-rows: auto auto 1fr auto` — кнопка «ЧИТАТИ» на одному рівні в ряду;
- адаптивні `min-height` опису на планшеті/мобільному.

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
| Автопрокрутка | **Вимкнена** (лише ручна навігація + drag) |

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

**НОВИНКИ** — окрема **index-карусель** (`NewsCarouselCover`, стрілки в `HomePage2`), **не** `BookScrollerCarousel`.

### 3.1. Свайп мишкою в «НОВИНКИ»

| Файл | Деталі |
|------|--------|
| `shared/carousel/useCarouselIndexSwipe.ts` | Хук: `pointerdown` → рух ≥50 px → `onNext` / `onPrev`; блокує клік після drag |
| `main/HomePage2.tsx` | `useCarouselIndexSwipe` на мобільній картці (`mg2-mobileCard`) і десктопному банері (`mg2-desktopBanner`); `enabled` коли `total > 1` |
| `main/HomePage.module.css` | `.mg2-newsSwipeTarget` — `cursor: grab`; `.carousel-index-dragging` — `grabbing` |

Напрямок як у `BookScrollerCarousel`: свайп **ліворуч** → наступна новина, **праворуч** → попередня. Кліки по `button`, `a` та іншим інтерактивним елементам не перехоплюються.

### 3.2. Обрізка опису в каруселях головної

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
- Картки: **BOOK_CARDS_FRONTEND.md** (`BookCardTitle`, marquee назв)
- Сторінка книги: **BOOK_PAGE_DATA_FLOW.md**
- Реклама: **ADVERTISING_BOOK_SETTINGS_FLOW.md**

---

**Останнє оновлення:** 2026-06-28 (автопрокрутка реклами 5 с / idle 15 с, коротка остання сторінка, `useCarouselIndexSwipe` для «Новинок», `carouselFew`)
