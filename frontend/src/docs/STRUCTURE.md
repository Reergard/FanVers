# Структура фронтенду FanVers (Vite + React + TypeScript)

Цей документ пояснює **для чого потрібна кожна папка/файл**, **чому вона існує** та **як її використовувати** (з короткими прикладами).

> **Просте правило**
>
> - **Макет** (Header / Footer / фон / основна область) знаходиться в `app/` (Base).
> - **Сторінки** зберігаються у папках функціональності типу `main/`, `catalog/` тощо.
> - **Повторно використовувані блоки** — у `shared/` та `widgets/`.
> - **Глобальні зображення та іконки** — у `assets/`.
> - **Точки входу** (`main.tsx`, `App.tsx`) з’єднують усе в одне ціле.

---

## Поточне дерево

```txt
frontend/src/
├── api/
│   ├── catalogApi.ts
│   ├── endpoints.ts
│   ├── http.ts
│   ├── httpRaw.ts
│   ├── mainApi.ts         # getBooksNews — новинки для головної (НОВИНКИ)
│   ├── ratingApi.ts
│   ├── searchApi.ts
│   └── reviewsApi.ts
├── app/
│   ├── Base.tsx
│   └── Base.module.css
├── auth/
│   ├── bootstrap.ts
│   ├── csrf.ts
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   ├── RequireAuth.tsx
│   ├── service.ts
│   ├── store.ts
│   ├── token.ts
│   ├── useAuth.ts
│   ├── refreshCore.ts
│   ├── refreshMutex.ts
│   ├── authLogger.ts
│   └── authSelfTest.ts
├── catalog/
│   ├── AbandonedTranslations.tsx
│   ├── AbandonedTranslations.css
│   ├── AddChapter.tsx
│   ├── BookDetailLayout.tsx
│   ├── BookDetailOwner.tsx
│   ├── BookDetailReader.tsx
│   ├── BookDetailRouter.tsx
│   ├── BookDetailSkeleton.tsx
│   ├── CreateBookPage.tsx
│   ├── components/
│   │   └── BookForm/
│   │       ├── BookForm.tsx
│   │       ├── BookForm.module.css
│   │       └── bookForm.utils.ts
│   ├── hooks/
│   │   ├── useBookBySlug.ts
│   │   ├── useBookFormMeta.ts
│   │   └── useBookUpdate.ts
│   ├── sections/
│   ├── settings/
│   │   ├── SettingsBook.tsx
│   │   ├── SettingsBook.css
│   │   ├── GeneralSettings.tsx
│   │   ├── Subscription.tsx
│   │   ├── Advertising.tsx
│   │   └── AccessRights.tsx
│   ├── assets/
│   ├── styles/
│   │   └── AddChapter.module.css
│   └── ...
├── BookCard/              # Єдиний компонент карток книг (variant: default, withTags, bookmark, ad). Детально: docs/BOOK_CARDS_FRONTEND.md
│   ├── BookCard.tsx
│   └── BookCard.css
├── main/
│   ├── HomePage.tsx
│   ├── HomePage.module.css
│   ├── HomePage1.tsx
│   ├── HomePage2.tsx
│   └── HomePage3.tsx
├── navigation/
│   ├── FilterDropdown.tsx
│   ├── FilterDropdown.module.css
│   ├── ShowMoreNavigation.tsx
│   ├── ShowMoreNavigation.module.css
│   ├── SortByNavigation.tsx
│   └── SortByNavigation.module.css
├── search/
│   ├── search.tsx
│   └── search.css
├── chat/
│   ├── Chat.tsx
│   ├── ChatPage.tsx
│   ├── Chat.module.css
│   ├── components/
│   ├── api/
│   ├── store/
│   └── ws/
├── settings/
│   ├── adultContentStore.ts
│   └── useAdultContent.ts
├── users/
│   ├── Profile.tsx
│   ├── Profile.module.css
│   ├── profileService.ts
│   ├── types.ts
│   └── assets/
├── website_advertising/
│   ├── AdvertisingBooks.tsx
│   └── (BookCard використовується з variant=ad)
├── shared/
│   ├── Container.tsx
│   ├── Container.module.css
│   ├── Icon.tsx
│   ├── SvgSprite.tsx
│   ├── FrameLink/
│   ├── MenuPanel/
│   ├── MenuList/
│   ├── AvatarOrbit/
│   ├── ScrollIndicator/
│   ├── ScrollToTop.tsx
│   ├── ActionButton/
│   ├── Modal/
│   ├── NotificationModal/
│   │   ├── NotificationModal.tsx
│   │   ├── NotificationModal.module.css
│   │   ├── NotificationProvider.tsx
│   │   └── AutoCloseNotificationModal.tsx
│   ├── hooks/
│   │   └── useDebouncedValue.ts
│   ├── menu/
│   └── utils/
├── widgets/
│   ├── header/
│   │   ├── Header.tsx
│   │   ├── Header.module.css
│   │   └── UserMenuOverlay/
│   └── footer/
│       ├── Footer.tsx
│       └── Footer.module.css
├── assets/
│   ├── logos/
│   ├── backgrounds/
│   ├── fonts/
│   └── ...
├── docs/
│   ├── ABANDONED_TRANSLATIONS_FRONTEND.md
│   ├── ADD_CHAPTER_FLOW.md
│   ├── BOOK_CARDS_FRONTEND.md
│   ├── BOOK_CREATE_SETTINGS_FLOW.md
│   ├── AUTHENTICATION_FRONTEND.md
│   ├── USER_DATA_FLOW.md
│   ├── BOOK_PAGE_DATA_FLOW.md
│   ├── BOOK_PAGE_DESIGN_DATA_FLOW.md
│   ├── CHAPTER_PAGE_DATA_FLOW.md
│   ├── COMMENTS_FRONTEND.md
│   ├── CHAT_FRONTEND.md
│   ├── COMPONENTS.md
│   ├── Concept.md
│   ├── NOTIFICATIONS_FRONTEND.md
│   ├── PAGINATION_SHOW_MORE_FRONTEND.md
│   ├── SORT_BY_NAVIGATION_FRONTEND.md
│   ├── RATINGS_FRONTEND.md
│   ├── SEARCH_FRONTEND.md
│   ├── ANALYTICS_FRONTEND.md
│   ├── LISTS_AND_CAROUSELS_FRONTEND.md
│   ├── TRENDS_AND_ANALYTICS_FRONTEND.md   # старе ім’я; вміст перенесено в ANALYTICS + LISTS_AND_CAROUSELS
│   └── STRUCTURE.md
├── App.tsx
├── main.tsx
├── main.css
└── responsive-variables.css
```

---

## `main.tsx` — точка входу React (старт застосунку)

**Що це:** файл, у якому React монтується в HTML-сторінку.

**Навіщо існує:** Vite завантажує `main.tsx` першим. Він створює React-root і рендерить `<App />`.

**Типовий вміст:**
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./main.css"; // глобальні стилі (токени, базова типографіка тощо)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Ключова ідея:** тут майже не розміщують UI. Це файл-завантажувач.

---

## `App.tsx` — корінь застосунку (зв’язуюча ланка)

**Що це:** компонент верхнього рівня, який поєднує:
- маршрутизацію (React Router),
- провайдери (auth / theme / query client пізніше),
- глобальний макет (`Base`).

**Навіщо існує:** потрібне одне місце, яке говорить:
> «Ось структура мого застосунку: роутер → макет → сторінки»

**Поточна реалізація (з роутером):**
```tsx
// Bootstrap auth перед показом Routes; QueryClientProvider, NotificationProvider
// Маршрути: /, /profile, /bookmarks, /my-translations, /authors, /translators, /login, /messages, /chat, /catalog, /abandoned, /create-book, /books/:slug/settings, /books/:slug/add-chapter, /books/:bookSlug/chapters/:chapterSlug, /books/:slug
// Suspense + lazy для сторінок (Profile, BookmarksPage, UserTranslations, Authors, TranslatorsList, LoginPage, NotificationsPage, Catalog, MagicalGuide, AbandonedTranslations, SearchPage, ChatPage, CreateBookPage, SettingsBook, AddChapter, ChapterDetailRouter, BookDetailRouter)
```

---

## `app/` — «оболонка» сайту (макет + глобальний фон)

### `app/Base.tsx`
**Що це:** шаблон макета (аналог `base.html` у Django).

**Навіщо існує:** більшість сторінок мають спільні:
- фон,
- хедер,
- футер,
- область `<main>`, де рендеряться сторінки.

**Поточна структура:**
```tsx
import styles from "./Base.module.css";
import { Header } from "../widgets/header/Header";
import { Footer } from "../widgets/footer/Footer";
import { SvgSprite } from "../shared/SvgSprite";
import { ScrollIndicator } from "../shared/ScrollIndicator/ScrollIndicator";

type Props = { children: React.ReactNode };

export function Base({ children }: Props) {
  return (
    <div className={styles.app}>
      <SvgSprite />
      <ScrollIndicator />
      <div className={styles.bg} aria-hidden="true" />
      <Header />
      <main className={styles.main} role="main">
        {children}
      </main>
      <Footer />
    </div>
  );
}
```

### `app/Base.module.css`
**Що це:** CSS Modules для макета Base.

**Навіщо існує:** стилі Base не повинні «протікати» в інші компоненти. CSS Modules ізолюють імена класів.

**Приклад:**
```css
.app {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  position: relative;
  color: rgba(255,255,255,.92);
}

.bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: #050D11;
}

.main {
  flex: 1;
  padding-block: 24px;
}

/* Спеціальні правила для 4K екранів */
@media (min-width: 2560px) and (min-height: 1400px) {
  .main {
    padding-block: 80px;
    min-height: auto;
    display: grid;
    align-content: start;
    gap: 40px;
    line-height: 1.6;
  }
  .app {
    min-height: auto;
  }
}
```

**Порада:** тут тримайте **глобальний фон і загальні відступи сторінок**, бо вони застосовуються до всіх сторінок.

---

## `api/` — запити до сервера

**Що це:** axios-клієнт, ендпоінти, інтерцептори (401 → refresh, retry).

**Файли:**
- `http.ts` — axios з Authorization, 401-interceptor (refreshSessionForce → retry → doLogout)
- `httpRaw.ts` — axios без інтерцепторів для refresh/logout (withCredentials)
- `endpoints.ts` — URL API (login, register, auth-status, profile, add-balance, коментарі, рейтинги, booksNews тощо)
- `catalogApi.ts` — API для каталогу книг (book, volumes, chapters)
- `mainApi.ts` — getBooksNews() для блоку НОВИНКИ на головній (`GET /api/main/books-news/`)
- `searchApi.ts` — API пошуку книг (`searchBooks`) для сторінки `/search`
- `ratingApi.ts` — API рейтингів книги: fetchBookRatings(slug), submitRating(slug, type, value); нормалізація відповіді. Див. docs/RATINGS_FRONTEND.md.
- `reviewsApi.ts` — API коментарів (книга/глава): fetch, post, delete, reaction, owner_like. Див. docs/COMMENTS_FRONTEND.md.
- ТОП за періодом: `api/top/*` (`topApi`, типи, `normalizeTopReaderRow`, `mapTopBook`), `endpoints.topBooks`, хук **`shared/hooks/useTopBooks.ts`**, карусель **`main/MagicalGuide3.tsx`** (`GET /api/analytics_books/top/?type=...`). **Тренди** (майбутнє) — `MagicalGuide1` без цього API. Див. **docs/LISTS_AND_CAROUSELS_FRONTEND.md**, **docs/ANALYTICS_FRONTEND.md**, `backend/docs/ANALYTICS_BOOKS_BACKEND.md`.

---

## `auth/` — авторизація

**Що це:** JWT access (в памʼяті), refresh (HttpOnly cookie), CSRF, store, bootstrap, LoginForm, RegisterForm.

**Ключові файли:** `store.ts`, `service.ts`, `useAuth.ts`, `bootstrap.ts`, `token.ts`, `refreshCore.ts`, `refreshMutex.ts`. Детально — `docs/AUTHENTICATION_FRONTEND.md`, `docs/USER_DATA_FLOW.md`.

---

## `routes/` — визначення маршрутів (поки що порожня)

**Що це:** папка для конфігурацій маршрутів, шляхів і (пізніше) лінивої загрузки.

**Навіщо існує:** коли сторінок стане багато, зберігати маршрути в `App.tsx` стане незручно.
Логіку маршрутизації можна винести в `routes/`.

**Поточний стан:** папка не створена. Маршрути визначені безпосередньо в `App.tsx` (/, /profile, /bookmarks, /my-translations, /authors, /translators, /login, /messages, /chat, /catalog, /abandoned, /create-book, /books/:slug/settings, /books/:slug/add-chapter, /books/:bookSlug/chapters/:chapterSlug, /books/:slug).

**Майбутній приклад:** `routes/AppRoutes.tsx`
```tsx
import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import HomePage from "../main/HomePage";

// Лінива загрузка для важких сторінок
const CatalogPage = lazy(() => import("../catalog/CatalogPage"));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route 
        path="/catalog" 
        element={
          <Suspense fallback={<div>Завантаження...</div>}>
            <CatalogPage />
          </Suspense>
        } 
      />
    </Routes>
  );
}
```

---

## `navigation/` — компоненти навігації списків

### `navigation/ShowMoreNavigation.tsx`
**Що це:** єдина обгортка кнопки `Показати ще` для локальної пагінації списків.

**Навіщо існує:** щоб не дублювати однакову перевірку `visibleCount < totalCount` і рендер `ShowMoreButton` у кожній сторінці.

**Пов’язані файли:**
- `navigation/ShowMoreNavigation.module.css`
- `shared/ActionButton/ActionButton.tsx` (`ShowMoreButton`)
- `docs/PAGINATION_SHOW_MORE_FRONTEND.md`

### `navigation/SortByNavigation.tsx`
**Що це:** єдина обгортка для контролу `Сортувати за` (label + pill + native select).

**Навіщо існує:** щоб не дублювати однакову розмітку і стилі сортування на різних сторінках.

**Пов’язані файли:**
- `navigation/SortByNavigation.module.css`
- `docs/SORT_BY_NAVIGATION_FRONTEND.md`

### `navigation/FilterDropdown.tsx`
**Що це:** переиспользуемий dropdown для фільтрів (позиціонування відносно кнопки, рендер через portal).

**Навіщо існує:** щоб не дублювати логіку випадаючих фільтрів, блокування скролу сторінки і базову поведінку закриття (outside click, Escape).

**Пов’язані файли:**
- `navigation/FilterDropdown.module.css`
- `shared/hooks/useScrollLock.ts`

---

## `search/` — фіча пошуку книг

**Що це:** сторінка `/search` з автопошуком, фільтрами, сортуванням і клієнтською пагінацією.

- `search/search.tsx` — логіка і розмітка сторінки
- `search/search.css` — стилі (через `@import` використовує стилі `AbandonedTranslations.css`)

Пов’язано з:

- `api/searchApi.ts`
- `auth/useAuth.ts`
- `navigation/FilterDropdown.tsx`
- `settings/useAdultContent.ts`
- `shared/hooks/useDebouncedValue.ts`
- `shared/NotificationModal/NotificationProvider.tsx`
- `docs/SEARCH_FRONTEND.md`

---

## `chat/` — фіча ChatVerse (особисті повідомлення)

**Що це:** сторінка `/chat` зі списком діалогів, вікном вибраного чату, створенням/видаленням чату, realtime-повідомленнями.

Склад:

- `Chat.tsx` — thin re-export на `ChatPage`.
- `ChatPage.tsx` — page orchestration: auth-gate, завантаження чатів, підключення ws конкретного чату.
- `components/ChatList.tsx` — лівий список чатів + кнопка створення.
- `components/ChatWindow.tsx` — повідомлення, відправка, confirm delete.
- `components/CreateChatModal.tsx` — модалка створення через `shared/Modal/Modal`.
- `api/chatApi.ts`, `api/types.ts` — HTTP-контракти.
- `store/chatStore.ts`, `store/useChat.ts` — external store (`useSyncExternalStore`).
- `ws/chatWs.ts`, `ws/counterWs.ts` — realtime-шар.

Пов’язано з:

- `api/endpoints.ts` (`API.chat`)
- `widgets/header/Header.tsx` (`counterWs`, періодичний refetch списку чатів, бейдж `unreadTotal` через `useChat`)
- `docs/CHAT_FRONTEND.md`

---

## `shared/` — дрібні повторно використовувані блоки

### `shared/Container.tsx`
**Що це:** універсальна обгортка, яка центрує контент і додає адаптивні бічні відступи.

**Навіщо існує:** без неї довелося б дублювати CSS, а ширина сторінок «стрибала» б.

### `shared/Icon.tsx`
**Що це:** компонент для рендеру іконок з глобального SVG-спрайту.

**Використання:**
```tsx
<Icon name="search" title="Пошук" />
<Icon name="bell" className={styles.icon} />
```

### `shared/SvgSprite.tsx`
**Що це:** компонент, який завантажує глобальний SVG-спрайт (`public/sprite.svg`) один раз.

**Навіщо існує:** спрайт має бути в DOM, щоб працювали `<use href="#icon-name" />`. Рендериться в `Base.tsx`.

**Нюанс:** для сторінки глави використовується окремий спрайт `public/sprite-book.svg` через `shared/SvgSpriteBook.tsx`.

### `shared/FrameLink.tsx`
**Що це:** стилізована навігаційна посилання з рамкою (використовується в Header NAV).

**Використання:**
```tsx
<FrameLink to="/catalog">Каталог</FrameLink>
```

### `shared/MenuPanel.tsx` та `shared/MenuList.tsx`
**Що це:** компоненти для рендеру меню користувача (використовуються в `UserMenuOverlay`).

**MenuPanel** містить аватар з орбитою, ім'я користувача, CTA-кнопку та список меню.

**MenuList** рендерить список пунктів меню з іконками.

### `shared/AvatarOrbit.tsx`
**Що це:** декоративний компонент аватара з SVG-орбитою навколо.

**Використання:** в `MenuPanel` та інших місцях, де потрібен аватар з декором.

### `shared/ScrollIndicator/`
**Що це:** кастомний індикатор прокрутки (overlay), який замінює нативну полосу прокрутки.

**Особливості:**
- Не впливає на layout (position: fixed)
- Керується через CSS-змінні
- Автоматично ховається, якщо контент не потребує скроллу
- Підтримка `prefers-reduced-motion`

### `shared/Modal/`, `shared/NotificationModal/`
**Що це:** модальні вікна (`Modal`) та глобальні toast через `NotificationModal` і `AutoCloseNotificationModal`. Провайдер `NotificationModal/NotificationProvider.tsx` дає `useNotification()`: `showSuccess`, `showError`, `showInfo`, `showWarning`, **`showSuccessAutoClose(message)`** — успіх без кнопок, авто-закриття через 3 с (використовується після створення глави).

### `shared/ActionButton/`
**Що це:** стилізована кнопка для дій.

### `shared/utils/requestThrottle.ts`
**Що це:** обмеження частоти запитів (throttling) для рейтингів: мінімальний інтервал 100 ms, до 30 запитів/хв по ключу, single-flight (один активний запит на ключ). Використовується в `BookRatingStars` при відправці оцінки. Експорт: `requestThrottle`, `createRequestKey(bookSlug, ratingType, action)`.

### `shared/utils/errorUtils.ts`
**Що це:** утиліти для обробки помилок.

### `shared/hooks/`
**useMedia.ts** — хук для відстеження медіа-запитів (наприклад, для визначення mobile/desktop).

**useScrollLock.ts** — хук для блокування скроллу body (iOS-safe, зберігає позицію).

**useDebouncedValue.ts** — універсальний debounce-хук (використовується на сторінці пошуку `/search` для автопошуку з затримкою).

---

## `settings/` — локальні глобальні настройки фронтенду

- `settings/adultContentStore.ts` — глобальний store `hideAdultContent` на `localStorage` + `storage` event + підписки.
- `settings/useAdultContent.ts` — React-хук на базі `useSyncExternalStore`.

Використання:

- `search/search.tsx` (передача `adult_content` у пошук як `!hideAdultContent`);
- `users/Profile.tsx` (чекбокс "Прибрати 18+").

### `shared/menu/menuData.ts`
**Що це:** єдине джерело даних для меню (USER_MENU, NAV_MENU).

**Навіщо існує:** щоб не дублювати дані меню в різних компонентах.



### `shared/Container.tsx`
**Що це:** компонент-обгортка з підтримкою prop `as` для вибору HTML-тега.

**Приклад використання:**
```tsx
<Container>Контент</Container>
<Container as="section">Секція</Container>
<Container as="header" className="custom">Хедер</Container>
```

### `shared/Container.module.css`
```css
.container {
  max-width: 1280px;
  margin-inline: auto;
  padding-inline: clamp(14px, calc(3 * var(--vwu)), 28px);
}

/* На 4K екранах збільшуємо max-width */
@media (min-width: 2560px) and (min-height: 1400px) {
  .container {
    max-width: 1680px;
  }
}
```

**Чому `clamp()` корисний:** на малих екранах відступи менші, на великих — трохи більші, але в межах норми. `--vwu` обмежує вплив `vw` на дуже великих екранах.

---

## `widgets/` — великі UI-блоки, що використовуються на багатьох сторінках

### `widgets/header/`
- `Header.tsx` — хедер сайту (лого, меню, блок користувача, бургер тощо)
- `Header.module.css` — стилі хедера

### `widgets/footer/`
- `Footer.tsx` — футер сайту (посилання, дракони, соцмережі, 18+ текст тощо)
- `Footer.module.css` — стилі футера

**Навіщо widgets:** Header/Footer — це не дрібні shared-компоненти, а великі секції UI, що повторюються.

---

## `catalog/` — фіча Каталог (сторінка книги)

**Що це:** сторінка книги `/books/:slug` — BookDetailRouter, BookDetailLayout, BookDetailOwner, BookDetailReader, секції (BookHero, BookDescription, BookChapters, **BookCommentsContainer**, **BookRatingStars** тощо). Також у фічі `catalog/`: сторінка глави `ChapterDetailRouter` + `ChapterDetail` для `/books/:bookSlug/chapters/:chapterSlug`, сторінка додавання глави `AddChapter.tsx` для `/books/:slug/add-chapter`, сторінка створення книги `CreateBookPage.tsx` для `/create-book`, сторінка налаштувань книги `SettingsBook.tsx` для `/books/:slug/settings`, покинуті переклади `AbandonedTranslations.tsx` для `/abandoned`.

**Маршрути (App.tsx):** `/create-book` → CreateBookPage, `/books/:slug/settings` → SettingsBook, `/books/:slug/add-chapter` → AddChapter (оголошується **перед** `/books/:slug`), `/books/:bookSlug/chapters/:chapterSlug` → ChapterDetailRouter, `/books/:slug` → BookDetailRouter, `/abandoned` → AbandonedTranslations.

---

## `website_advertising/` — реклама книг

**Що це:** AdvertisingBooks — блоки реклами (використовує BookCard variant=ad).

---

## `main/` — фіча Home (сторінка + локальні стилі)

### `main/HomePage.tsx`
**Що це:** головна сторінка, яка об'єднує кілька секцій (HomePage1, HomePage2, HomePage3).

**Структура:**
```tsx
export function HomePage() {
  return (
    <section className={styles.page}>
      <Container>
        <div className={styles.homepage}>
          <Home1 />
          <Home2 />
          <Home3 />
        </div>
      </Container>
    </section>
  );
}
```

### `main/HomePage.module.css`
Стилі лише для цієї сторінки. Вони НЕ повинні впливати на інші сторінки.

### `main/HomePage1.tsx`, `HomePage2.tsx`, `HomePage3.tsx`
Окремі секції головної сторінки:
- **HomePage2** — блок «НОВИНКИ»: карусель нових книг з API (`mainApi.getBooksNews()` → `GET /api/main/books-news/`), рейтинги через `ratingApi.fetchBookRatings`, автоперемикання 9 с.
- **HomePage3** — блок «ОСТАННІ ОНОВЛЕННЯ»: книги з недавніми оновленнями глав.

### `main/MagicalGuide.tsx`, `MagicalGuide1.tsx`, `MagicalGuide2.tsx`, `MagicalGuide3.tsx`
**Маршрут:** `/MagicalGuide`. **Тренди** (`MagicalGuide1`) — заглушка під майбутній окремий API. **Рекомендації** (`MagicalGuide2`) — заглушки. **ТОП** (`MagicalGuide3`) — `useTopBooks` → `GET /api/analytics_books/top/`. Деталі: **docs/LISTS_AND_CAROUSELS_FRONTEND.md**; бекенд: `backend/docs/LISTS_AND_CAROUSELS_BACKEND.md`, `ANALYTICS_BOOKS_BACKEND.md`.

---

## `users/` — фіча Profile (сторінка користувача)

### `users/Profile.tsx`
**Що це:** сторінка профілю користувача (аватар, баланс, deposit/withdraw, translate/author, налаштування).

**Маршрут:** `/profile` (визначений в `App.tsx`).

### `users/profileService.ts`
**Що це:** API-функції профілю (getMyProfile, uploadProfileImage, depositBalance, withdrawBalance тощо).

### `users/types.ts`
**Що це:** типи UserProfile, BalanceHistoryItem, NotificationSettingsPatch.

### `users/Profile.module.css`
Стилі лише для сторінки профілю.

---

## `assets/` — глобальні ресурси (для всього сайту)

Використовуйте для ресурсів, які застосовуються у багатьох місцях.

Рекомендовані підпапки:
- `assets/icons/` — дрібні UI-іконки
- `assets/logos/` — логотипи FanVers
- `assets/backgrounds/` — лише якщо згодом з’являться фонові картинки  
  (якщо фон — чистий CSS, папку можна не використовувати)

**Приклад використання:**
```tsx
import logo from "../assets/logos/fanvers-logo.svg";

export function HeaderLogo() {
  return <img src={logo} alt="FanVers" />;
}
```

---

## `main.css` — глобальний CSS (токени + базові правила)

**Що це:** глобальний CSS, який імпортується один раз у `main.tsx`.

**Що тут є:**
- CSS-змінні (токени): `--container-max`, `--gutter`, `--text`, `--muted`, `--vwu` (обмеження vw)
- змінні для ScrollIndicator (`--si-*`)
- `@font-face` для шрифтів (Seminaria, SofiaSansSemiCondensed, BadScript, Arizonia, AlleycatICG)
- базові reset правила (`box-sizing`, `body margin`, `img display:block`)
- приховання нативної полоси прокрутки
- стилі для ScrollIndicator (overlay)
- базові стилі для типографіки (`a`, `button`, `img`)
- спеціальні правила для 4K екранів (zoom, font-size)

**Правило:** тут тільки глобальні правила. Стилі компонентів — у CSS Modules.

---

## Правила іменування та розміщення (щоб не загубитися)

1) **Entry-файли**
- `main.tsx` — точка входу (монтує React, імпортує `main.css`).
- `App.tsx` — корінь застосунку (роутер + Base + маршрути).

2) **Макет**
- Макет живе в `app/` (Base).
- Base включає SvgSprite, ScrollIndicator, Header, Footer.

3) **Сторінки**
- Сторінки — у своїх фіча-папках (`main/`, `users/`, `catalog/` тощо).
- Стилі сторінки — поруч із нею (переважно `*.module.css`, але в проєкті також є звичайні `.css` для окремих сторінок, напр. `catalog/AbandonedTranslations.css`).
- Кожна фіча може мати підкомпоненти (наприклад, `HomePage1.tsx`).

4) **Shared**
- `shared/` — для дрібних повторно використовуваних компонентів, хуків, утиліт.
- Компоненти з власними стилями — у папках (`FrameLink/`, `MenuPanel/` тощо).
- Прості компоненти без стилів — окремі файли (`Icon.tsx`, `SvgSprite.tsx`).

5) **Widgets**
- `widgets/` — для великих повторюваних секцій (Header, Footer).
- Складні віджети можуть мати підкомпоненти (`UserMenuOverlay/` в `header/`).

6) **Assets**
- Для багатьох сторінок — `assets/` (іконки, логотипи, фони, шрифти).
- Для однієї фічі — можна зберігати локально в папці фічі (якщо потрібно).

7) **Routes**
- Поки що маршрути в `App.tsx`.
- Коли сторінок стане багато — винести в `routes/AppRoutes.tsx`.

8) **API**
- `api/` — http.ts, httpRaw.ts, endpoints.ts, catalogApi.ts, mainApi.ts, searchApi.ts, ratingApi.ts, reviewsApi.ts.

---

## Швидка перевірка «куди це класти?»

- «Це **картка книги**?» → **завжди** `BookCard/BookCard.tsx` з потрібним `variant` (default, withTags, bookmark, ad). Інших компонентів карток книг немає.
- «Це **сторінка**?» → фіча-папка (`main/`, `users/`, `catalog/`)
- «Це **макет сайту**?» → `app/`
- «Це дрібний повторюваний компонент/хук/утиліта?» → `shared/`
- «Це велика повторювана секція (Header/Footer)?» → `widgets/`
- «Це глобальна іконка/лого/фон/шрифт?» → `assets/`
- «Це дані меню/конфігурація?» → `shared/menu/` або `shared/`
- «Це маршрути?» → поки що `App.tsx`, пізніше `routes/`
- «Це API-запити?» → `api/`

---

**Готово.** Збережіть цей файл у репозиторії як `STRUCTURE.md` — це ваш єдиний «джерело правди» щодо структури фронтенду.
