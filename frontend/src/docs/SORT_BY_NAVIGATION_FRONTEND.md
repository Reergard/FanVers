# Сортування через "Сортувати за" (Frontend)

Документ описує поточну реалізацію сортування у фронтенді через компонент `SortByNavigation` на основі реального коду.

---

## 1) Базовий компонент

### `frontend/src/navigation/SortByNavigation.tsx`

Єдина UI-обгортка для контролу сортування:

- приймає `value`, `options`, `onChange`, `ariaLabel`;
- показує активний текст через пошук поточного `value` у `options`;
- викликає `onChange(nextValue)` при зміні нативного `select`.

### `frontend/src/navigation/SortByNavigation.module.css`

Містить стилі:

- лейбл `Сортувати`/`Сортувати за`;
- pill-контейнер;
- прозорий нативний `select` поверх pill;
- декоративну стрілку.

---

## 2) Послідовність роботи від кліку до результату

1. Користувач відкриває список у `SortByNavigation` і обирає опцію.
2. Компонент викликає `onChange` сторінки з новим `value`.
3. Сторінка оновлює свій `sort`/`sortBy` state.
4. `useMemo` перераховує відсортований масив.
5. У списку/таблиці рендериться новий порядок елементів.
6. Якщо на сторінці є `ShowMoreNavigation`, `visibleCount` скидається до `PAGE_SIZE` у `useEffect` (щоб показ починався з початку нового порядку).

---

## 3) Де використовується зараз

## `frontend/src/users/Authors.tsx`

- `SortKey`: `books | comments | lastVisit`.
- Правила:
  - `books`: більше книг вище;
  - `comments`: більше коментарів вище;
  - `lastVisit`: новіша дата вище (`DD.MM.YYYY` -> timestamp).
- Після зміни сорту скидається `visibleCount`.

## `frontend/src/users/TranslatorsList.tsx`

- `SortKey`: `books | comments | lastVisit`.
- Правила такі самі, як у Authors:
  - за книгами/коментарями спадно;
  - за датою відвідування спадно.
- Після зміни сорту скидається `visibleCount`.

## `frontend/src/catalog/Catalog.tsx`

- `SortKey`: `created | views | incomeDay | incomeMonth`.
- Правила:
  - `created`: новіші `created_at` вище;
  - `views`: більше `daily_views` вище;
  - `incomeDay`: більше `daily_income` вище;
  - `incomeMonth`: більше `monthly_income` вище.
- Після зміни сорту скидається `visibleCount`.

## `frontend/src/catalog/AbandonedTranslations.tsx`

- `SortKey`: `choose | created | updated | views | income`.
- Правила:
  - `choose`: порядок як у масиві після фільтрації;
  - `created`: новіші `created_at` вище;
  - `updated`: новіші `last_updated` вище;
  - `views`/`income`: тимчасовий fallback на сортування за назвою `title` (бо у відповіді цього endpoint немає окремих полів для такого сортування).
- Після зміни сорту скидається `visibleCount`.

## `frontend/src/bookmarks/BookmarksPage.tsx`

- `SortKey`: `updated | created | title`.
- Правила:
  - `updated`: новіші `updated_at` вище;
  - `created`: новіші `created_at` вище;
  - `title`: за назвою книги (`localeCompare`, `uk-UA`).
- Після зміни сорту скидається `visibleCount`.

---

## 4) Що не підключено

- У поточному `frontend/src` немає окремої сторінки пошуку (`Search*.tsx`), тому `SortByNavigation` для неї відсутній.
- У `frontend/src/catalog/CreateBookPage.tsx` немає кнопки/блоку `Сортувати за`; там використовується інший патерн (`PillSelect`) для полів форми створення книги.

---

## 5) Пов’язані файли

- `frontend/src/navigation/SortByNavigation.tsx`
- `frontend/src/navigation/SortByNavigation.module.css`
- `frontend/src/users/Authors.tsx`
- `frontend/src/users/TranslatorsList.tsx`
- `frontend/src/catalog/Catalog.tsx`
- `frontend/src/catalog/AbandonedTranslations.tsx`
- `frontend/src/bookmarks/BookmarksPage.tsx`
