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
├── app/
│   ├── Base.tsx
│   └── Base.module.css
├── routes/                   # поки що порожня (маршрути в App.tsx)
├── main/
│   ├── HomePage.tsx
│   ├── HomePage.module.css
│   ├── HomePage1.tsx
│   ├── HomePage2.tsx
│   └── HomePage3.tsx
├── users/
│   ├── Profile.tsx
│   └── Profile.module.css
├── shared/
│   ├── Container.tsx
│   ├── Container.module.css
│   ├── Icon.tsx
│   ├── SvgSprite.tsx
│   ├── FrameLink/
│   │   ├── FrameLink.tsx
│   │   └── FrameLink.module.css
│   ├── MenuPanel/
│   │   ├── MenuPanel.tsx
│   │   └── MenuPanel.module.css
│   ├── MenuList/
│   │   ├── MenuList.tsx
│   │   └── MenuList.module.css
│   ├── AvatarOrbit/
│   │   ├── AvatarOrbit.tsx
│   │   └── AvatarOrbit.module.css
│   ├── ScrollIndicator/
│   │   └── ScrollIndicator.tsx
│   ├── hooks/
│   │   ├── useMedia.ts
│   │   └── useScrollLock.ts
│   └── menu/
│       └── menuData.ts
├── widgets/
│   ├── header/
│   │   ├── Header.tsx
│   │   ├── Header.module.css
│   │   └── UserMenuOverlay/
│   │       ├── UserMenuOverlay.tsx
│   │       └── UserMenuOverlay.module.css
│   └── footer/
│       ├── Footer.tsx
│       └── Footer.module.css
├── assets/                   # ГЛОБАЛЬНІ ресурси для всього сайту
│   ├── icons/
│   ├── logos/
│   │   └── logo.png
│   ├── backgrounds/
│   │   └── menu_line.svg
│   ├── fonts/
│   │   ├── seminaria-normal.woff2
│   │   ├── SofiaSansSemiCondensedRegular.woff2
│   │   ├── BadScript-Regular.woff2
│   │   ├── Arizonia-Regular.woff2
│   │   └── AlleycatICG.woff2
│   └── 5VgZtO9jy5g.jpg
├── docs/
│   ├── Concept.md
│   └── STRUCTURE.md
├── App.tsx
├── main.tsx
└── main.css
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
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Base } from "./app/Base";
import HomePage from "./main/HomePage";
import Profile from "./users/Profile";

export default function App() {
  return (
    <BrowserRouter>
      <Base>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Base>
    </BrowserRouter>
  );
}
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

## `routes/` — визначення маршрутів (поки що порожня)

**Що це:** папка для конфігурацій маршрутів, шляхів і (пізніше) лінивої загрузки.

**Навіщо існує:** коли сторінок стане багато, зберігати маршрути в `App.tsx` стане незручно.
Логіку маршрутизації можна винести в `routes/`.

**Поточний стан:** папка існує, але поки що порожня. Маршрути визначені безпосередньо в `App.tsx`.

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

## `api/` — запити до сервера (поки що не існує)

**Що це:** майбутнє місце для:
- інстансу axios,
- базової URL-конфігурації,
- інтерцепторів,
- типізованих API-функцій.

**Навіщо існує:** щоб API-код не був розкиданий по сторінках і компонентах.

**Поточний стан:** папка поки що не створена. Коли з'явиться потреба в API-запитах, створіть `api/` і винесіть туди всю логіку роботи з бекендом.



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
**Що це:** сторінка профілю користувача.

**Маршрут:** `/profile` (визначений в `App.tsx`).

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
- Поки що папка `api/` не існує.
- Коли з'явиться потреба — створити `api/` для axios instance та API-функцій.

---

## Швидка перевірка «куди це класти?»

- «Це **сторінка**?» → фіча-папка (`main/`, `users/`, `catalog/`)
- «Це **макет сайту**?» → `app/`
- «Це дрібний повторюваний компонент/хук/утиліта?» → `shared/`
- «Це велика повторювана секція (Header/Footer)?» → `widgets/`
- «Це глобальна іконка/лого/фон/шрифт?» → `assets/`
- «Це дані меню/конфігурація?» → `shared/menu/` або `shared/`
- «Це маршрути?» → поки що `App.tsx`, пізніше `routes/`
- «Це API-запити?» → поки що немає, пізніше `api/`

---

**Готово.** Збережіть цей файл у репозиторії як `STRUCTURE.md` — це ваш єдиний «джерело правди» щодо структури фронтенду.
