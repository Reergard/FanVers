# Структура фронтенда FanVers (Vite + React + TypeScript)

Этот документ объясняет **для чего нужна каждая папка/файл**, **почему она существует**, и **как её использовать** (с небольшими примерами).

> **Правило большого пальца**
>
> - **Макет** (Header/Footer/фон/основная область) находится в `app/` (Base).
> - **Страницы** находятся в папках функциональности типа `main/`, `catalog/` и т.д.
> - **Переиспользуемые блоки** находятся в `shared/` и `widgets/`.
> - **Глобальные изображения/иконки** находятся в `assets/`.
> - **Точки входа** (`main.tsx`, `App.tsx`) связывают всё воедино.

---

## Текущее дерево

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
│   └── images/              # только для HomePage
├── shared/
│   ├── Container.tsx
│   └── Container.module.css
├── widgets/
│   ├── header/
│   └── footer/
├── assets/                   # ГЛОБАЛЬНЫЕ ресурсы, используемые по всему сайту
│   ├── icons/
│   ├── logos/
│   └── backgrounds/
├── App.tsx
├── main.tsx
└── main.css
```

---

## `main.tsx` — точка входа React (начало приложения)

**Что это:** файл, где React монтируется в HTML-страницу.

**Почему существует:** Vite загружает `main.tsx` первым. Он создаёт корень React и рендерит `<App />`.

**Типичное содержимое:**
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./main.css"; // глобальные стили (токены, базовая типографика и т.д.)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Ключевая идея:** здесь редко размещают UI. Это файл-"загрузчик".

---

## `App.tsx` — корень приложения (связующее звено)

**Что это:** компонент верхнего уровня, который связывает воедино:
- маршрутизацию (React Router),
- провайдеры (auth/theme/query client позже),
- глобальный макет (`Base`).

**Почему существует:** Нужно одно место, которое говорит:
> "Вот структура моего приложения: роутер → макет → страницы"

**Минимальный пример без роутера (для начала):**
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

**Пример с роутером (позже):**
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

## `app/` — "оболочка" сайта (макет + глобальный фон)

### `app/Base.tsx`
**Что это:** ваш шаблон макета (аналогично `base.html` в Django).

**Почему существует:** Большинство страниц имеют общие:
- фон,
- шапку,
- подвал,
- область `<main>`, где отображаются страницы.

**Типичная структура:**
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
**Что это:** CSS Modules для макета Base.

**Почему существует:** Стили Base не должны просачиваться в другие компоненты. С CSS Modules имена классов изолированы.

**Пример:**
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
  /* ваш тёмный фон + светящиеся градиенты */
  background:
    radial-gradient(circle at 30% 20%, rgba(0, 180, 180, 0.15), transparent 45%),
    #020a0b;
}

.main {
  flex: 1;
  padding-block: 24px;
}
```

**Совет:** Размещайте здесь **глобальный фон и общие отступы страниц**, потому что они применяются ко всем страницам.

---

## `routes/` — определения маршрутов (опционально сейчас, полезно скоро)

**Что это:** папка для хранения конфигураций маршрутов, путей и (позже) ленивой загрузки.

**Почему существует:** Как только у вас появится много страниц, хранение маршрутов внутри `App.tsx` станет беспорядочным.
Вы можете переместить логику маршрутизации в `routes/`.

**Пример (простой):** `routes/routes.tsx`
```tsx
import { HomePage } from "../main/HomePage";

export const routes = [
  { path: "/", element: <HomePage /> },
];
```

**Пример (с компонентами React Router):**
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
Затем в `App.tsx` вы просто рендерите `<AppRoutes />`.

---

## `api/` — server calls (axios/fetch layer)

**What it is:** a place for:
- axios instance,
- base URL config,
- interceptors (later),
- typed API functions.

**Why it exists:** You don't want API code scattered across pages/components.

**Typical file:** `api/http.ts`
```ts
import axios from "axios";

export const http = axios.create({
  baseURL: "/api", // in dev you proxy /api -> Django
  withCredentials: true, // if you use cookies for refresh tokens
});
```

**Example usage in a page:**
```ts
import { http } from "../api/http";

export async function loadProfile() {
  const { data } = await http.get("/me/");
  return data;
}
```

---

## `shared/` — reusable small building blocks

### `shared/Container.tsx`
**What it is:** a reusable wrapper that centers content and adds responsive side padding.

**Why it exists:** Without it you will repeat the same CSS everywhere and pages will “jump” in width.

**Example:**
```tsx
import styles from "./Container.module.css";

type Props = {
  children: React.ReactNode;
  as?: "div" | "section" | "header" | "footer";
  className?: string;
};

export function Container({ children, as = "div", className }: Props) {
  const Tag = as;
  return (
    <Tag className={[styles.container, className].filter(Boolean).join(" ")}>
      {children}
    </Tag>
  );
}
```

### `shared/Container.module.css`
```css
.container {
  max-width: 1280px;
  margin-inline: auto;
  padding-inline: clamp(14px, 3vw, 28px);
}
```

**Why `clamp()` is good:** on small screens padding is small, on big screens padding grows a bit, but stays reasonable.

---

## `widgets/` — big UI parts used across many pages

### `widgets/header/`
- `Header.tsx` — site header (logo, menu, user block, burger, etc.)
- `Header.module.css` — its styles

### `widgets/footer/`
- `Footer.tsx` — site footer (links, dragons, socials, 18+ text, etc.)
- `Footer.module.css` — its styles

**Why widgets exist:** Header/Footer are not “shared tiny components” — they are large sections of the UI that appear on many pages.

---

## `main/` — the Home feature (page + local styles + local images)

### `main/HomePage.tsx`
**What it is:** the Home page component.

**Example:**
```tsx
import styles from "./HomePage.module.css";

export function HomePage() {
  return (
    <section className={styles.page}>
      <h1>Home</h1>
    </section>
  );
}
```

### `main/HomePage.module.css`
Page-specific styles. They should NOT affect other pages.

### `main/images/`
Only images used by Home. If an image is used by multiple pages, move it to `assets/`.

---

## `assets/` — global assets (used across the whole site)

Use this for resources shared across many parts of the project.

Recommended subfolders:

- `assets/icons/` — small UI icons (search, bell, message, arrow, etc.)
- `assets/logos/` — FanVers logo variants (svg/png)
- `assets/backgrounds/` — only if you decide to use image backgrounds later.
  - If your background is only CSS gradients (like on your screenshots), you may keep this folder empty or remove it.

**Example usage:**
```tsx
import logo from "../assets/logos/fanvers-logo.svg";

export function HeaderLogo() {
  return <img src={logo} alt="FanVers" />;
}
```

---

## `main.css` — global CSS (tokens + base rules)

**What it is:** global CSS imported once in `main.tsx`.

**What should be here:**
- CSS variables (“tokens”): colors, spacing, font sizes
- base typography (`body`, `a`, `button`)
- resets / sensible defaults
- *not* page-specific styling

**Example:**
```css
:root {
  --bg: #020a0b;
  --text: rgba(255, 255, 255, 0.92);
  --accent: rgba(80, 220, 220, 1);
  --container: 1280px;
}

html, body {
  height: 100%;
}

body {
  margin: 0;
  color: var(--text);
  background: var(--bg);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

a {
  color: inherit;
}
```

---

## Naming & placement rules (so you don’t get lost later)

1) **Entry files**
- Keep `main.tsx` as the entry point.
- Keep `App.tsx` as the root component.

2) **Layout**
- Layout belongs in `app/` (Base).

3) **Pages**
- Pages belong to their feature folders (`main/`, `catalog/`, etc.).
- Page styles live next to the page (`HomePage.module.css`).

4) **Shared**
- `shared/` is for small reusable helpers (Container, Button, Modal, etc.).

5) **Widgets**
- `widgets/` is for large reusable parts (Header, Footer, Sidebar).

6) **Assets**
- If used across many pages: `assets/`
- If used only in one feature: `feature/images/`

---

## Quick “does this belong here?” checklist

- “Is it a **page**?” → feature folder (`main/`, `catalog/`, ...)
- “Is it the **site layout**?” → `app/`
- “Is it reusable everywhere and small?” → `shared/`
- “Is it a big section reused on many pages?” → `widgets/`
- “Is it a global icon/logo?” → `assets/`
- “Is it only for one page/feature?” → that feature’s `images/`

---

**Done.** Keep this file in the repo as `STRUCTURE.md` so you always have one source of truth.
