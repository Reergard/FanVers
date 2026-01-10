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
├── app/
│   ├── Base.tsx
│   └── Base.module.css
├── routes/
├── main/
│   ├── HomePage.tsx
│   ├── HomePage.module.css
│   └── images/              # лише для HomePage
├── shared/
│   ├── Container.tsx
│   └── Container.module.css
├── widgets/
│   ├── header/
│   └── footer/
├── assets/                   # ГЛОБАЛЬНІ ресурси для всього сайту
│   ├── icons/
│   ├── logos/
│   └── backgrounds/
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

**Мінімальний приклад без роутера (на старті):**
```tsx
import { Base } from "./app/Base";
import { HomePage } from "./main/HomePage";

export function App() {
  return (
    <Base>
      <HomePage />
    </Base>
  );
}
```

**Приклад з роутером (пізніше):**
```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Base } from "./app/Base";
import { HomePage } from "./main/HomePage";

export function App() {
  return (
    <BrowserRouter>
      <Base>
        <Routes>
          <Route path="/" element={<HomePage />} />
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

**Типова структура:**
```tsx
import styles from "./Base.module.css";
import { Header } from "../widgets/header/Header";
import { Footer } from "../widgets/footer/Footer";

type Props = { children: React.ReactNode };

export function Base({ children }: Props) {
  return (
    <div className={styles.app}>
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
  color: rgba(255, 255, 255, 0.92);
}

.bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  /* темний фон + світні градієнти */
  background:
    radial-gradient(circle at 30% 20%, rgba(0, 180, 180, 0.15), transparent 45%),
    #020a0b;
}

.main {
  flex: 1;
  padding-block: 24px;
}
```

**Порада:** тут тримайте **глобальний фон і загальні відступи сторінок**, бо вони застосовуються до всіх сторінок.

---

## `routes/` — визначення маршрутів (опційно зараз, корисно згодом)

**Що це:** папка для конфігурацій маршрутів, шляхів і (пізніше) лінивої загрузки.

**Навіщо існує:** коли сторінок стає багато, зберігати маршрути в `App.tsx` стає незручно.
Логіку маршрутизації можна винести в `routes/`.

**Простий приклад:** `routes/routes.tsx`
```tsx
import { HomePage } from "../main/HomePage";

export const routes = [
  { path: "/", element: <HomePage /> },
];
```

**Приклад з компонентом React Router:**
```tsx
// routes/AppRoutes.tsx
import { Routes, Route } from "react-router-dom";
import { HomePage } from "../main/HomePage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  );
}
```
Потім у `App.tsx` просто рендерите `<AppRoutes />`.

---

## `api/` — запити до сервера (шар axios/fetch)

**Що це:** місце для:
- інстансу axios,
- базової URL-конфігурації,
- інтерцепторів (пізніше),
- типізованих API-функцій.

**Навіщо існує:** щоб API-код не був розкиданий по сторінках і компонентах.



---

## `shared/` — дрібні повторно використовувані блоки

### `shared/Container.tsx`
**Що це:** універсальна обгортка, яка центрує контент і додає адаптивні бічні відступи.

**Навіщо існує:** без неї довелося б дублювати CSS, а ширина сторінок «стрибала» б.



### `shared/Container.module.css`
```css
.container {
  max-width: 1280px;
  margin-inline: auto;
  padding-inline: clamp(14px, 3vw, 28px);
}
```

**Чому `clamp()` корисний:** на малих екранах відступи менші, на великих — трохи більші, але в межах норми.

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

## `main/` — фіча Home (сторінка + локальні стилі + локальні зображення)

### `main/HomePage.tsx`
**Що це:** компонент головної сторінки.


```

### `main/HomePage.module.css`
Стилі лише для цієї сторінки. Вони НЕ повинні впливати на інші сторінки.

### `main/images/`
Лише зображення, що використовуються на Home. Якщо зображення потрібне на кількох сторінках — переносьте його в `assets/`.

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

**Що тут має бути:**
- CSS-змінні (токени): кольори, відступи, розміри шрифтів
- базова типографіка (`body`, `a`, `button`)
- reset / дефолтні правила
- **не** сторінкові стилі


```

---

## Правила іменування та розміщення (щоб не загубитися)

1) **Entry-файли**
- `main.tsx` — точка входу.
- `App.tsx` — корінь застосунку.

2) **Макет**
- Макет живе в `app/` (Base).

3) **Сторінки**
- Сторінки — у своїх фіча-папках (`main/`, `catalog/`, тощо).
- Стилі сторінки — поруч із нею.

4) **Shared**
- `shared/` — для дрібних повторно використовуваних хелперів.

5) **Widgets**
- `widgets/` — для великих повторюваних секцій (Header, Footer).

6) **Assets**
- Для багатьох сторінок — `assets/`.
- Для однієї фічі — `feature/images/`.

---

## Швидка перевірка «куди це класти?»

- «Це **сторінка**?» → фіча-папка (`main/`, `catalog/`)
- «Це **макет сайту**?» → `app/`
- «Це дрібний повторюваний компонент?» → `shared/`
- «Це велика повторювана секція?» → `widgets/`
- «Це глобальна іконка/лого?» → `assets/`
- «Це лише для однієї сторінки?» → `feature/images/`

---

**Готово.** Збережіть цей файл у репозиторії як `STRUCTURE.md` — це ваш єдиний «джерело правди» щодо структури фронтенду.
