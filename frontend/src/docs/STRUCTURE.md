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
│   ├── ratingApi.ts
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
│   ├── AddChapter.tsx
│   ├── BookDetailLayout.tsx
│   ├── BookDetailOwner.tsx
│   ├── BookDetailReader.tsx
│   ├── BookDetailRouter.tsx
│   ├── BookDetailSkeleton.tsx
│   ├── sections/
│   ├── assets/
│   ├── styles/
│   │   └── AddChapter.module.css
│   └── ...
├── main/
│   ├── HomePage.tsx
│   ├── HomePage.module.css
│   ├── HomePage1.tsx
│   ├── HomePage2.tsx
│   └── HomePage3.tsx
├── users/
│   ├── Profile.tsx
│   ├── Profile.module.css
│   ├── profileService.ts
│   ├── types.ts
│   └── assets/
├── website_advertising/
│   ├── AdvertisingBooks.tsx
│   └── BookAdCard/
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
│   ├── ActionButton/
│   ├── Modal/
│   ├── NotificationModal/
│   │   ├── NotificationModal.tsx
│   │   ├── NotificationModal.module.css
│   │   ├── NotificationProvider.tsx
│   │   └── AutoCloseNotificationModal.tsx
│   ├── hooks/
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
│   ├── ADD_CHAPTER_FLOW.md
│   ├── AUTH_CHANGES_LOG.md
│   ├── AUTHENTICATION_FRONTEND.md
│   ├── USER_DATA_FLOW.md
│   ├── BOOK_PAGE_DATA_FLOW.md
│   ├── BOOK_PAGE_DESIGN_DATA_FLOW.md
│   ├── COMMENTS_FRONTEND.md
│   ├── COMPONENTS.md
│   ├── Concept.md
│   ├── NOTIFICATIONS_FRONTEND.md
│   ├── RATINGS_FRONTEND.md
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
// Маршрути: / (HomePage), /profile (Profile), /books/:slug (BookDetailRouter)
// Suspense + lazy для Profile та BookDetailRouter
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
- `endpoints.ts` — URL API (login, register, auth-status, profile, add-balance, коментарі, рейтинги тощо)
- `catalogApi.ts` — API для каталогу книг (book, volumes, chapters)
- `ratingApi.ts` — API рейтингів книги: fetchBookRatings(slug), submitRating(slug, type, value); нормалізація відповіді. Див. docs/RATINGS_FRONTEND.md.
- `reviewsApi.ts` — API коментарів (книга/глава): fetch, post, delete, reaction, owner_like. Див. docs/COMMENTS_FRONTEND.md.

---

## `auth/` — авторизація

**Що це:** JWT access (в памʼяті), refresh (HttpOnly cookie), CSRF, store, bootstrap, LoginForm, RegisterForm.

**Ключові файли:** `store.ts`, `service.ts`, `useAuth.ts`, `bootstrap.ts`, `token.ts`, `refreshCore.ts`, `refreshMutex.ts`. Детально — `docs/AUTHENTICATION_FRONTEND.md`, `docs/USER_DATA_FLOW.md`.

---

## `routes/` — визначення маршрутів (поки що порожня)

**Що це:** папка для конфігурацій маршрутів, шляхів і (пізніше) лінивої загрузки.

**Навіщо існує:** коли сторінок стане багато, зберігати маршрути в `App.tsx` стане незручно.
Логіку маршрутизації можна винести в `routes/`.

**Поточний стан:** папка не створена. Маршрути визначені безпосередньо в `App.tsx` (/, /profile, /books/:slug).

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

**Що це:** сторінка книги `/books/:slug` — BookDetailRouter, BookDetailLayout, BookDetailOwner, BookDetailReader, секції (BookHero, BookDescription, BookChapters, **BookCommentsContainer**, **BookRatingStars** тощо). **Рейтинги (РЕЙТИНГ ТВОРУ, ЯКІСТЬ ПЕРЕКЛАДУ):** BookHero отримує `bookSlug` від Owner/Reader, робить useQuery за ключем `["book-ratings", slug]`, викликає `ratingApi.fetchBookRatings(slug)`; рендерить два блоки `BookRatingStars` (BOOK, TRANSLATION). Відправка оцінки — через `ratingApi.submitRating` і `requestThrottle`. Див. docs/RATINGS_FRONTEND.md. Секція коментарів: `BookCommentsContainer` робить useQuery за ключем `["book-comments", slug]` / `["chapter-comments", slug]`, викликає `reviewsApi`. Окрема сторінка **додавання глави**: `AddChapter.tsx`. Стилі сторінки книги — `styles/BookDetail.module.css`.

**Маршрути (App.tsx):** `/books/:slug/add-chapter` → AddChapter (оголошується **перед** `/books/:slug`), `/books/:slug` → BookDetailRouter.

---

## `website_advertising/` — реклама книг

**Що це:** AdvertisingBooks, BookAdCard — блоки реклами.

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
Окремі секції головної сторінки (можуть бути винесені в окремі компоненти для кращої організації).

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
- Стилі сторінки — поруч із нею (`*.module.css`).
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
- `api/` — http.ts, httpRaw.ts, endpoints.ts, catalogApi.ts, ratingApi.ts, reviewsApi.ts.

---

## Швидка перевірка «куди це класти?»

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
