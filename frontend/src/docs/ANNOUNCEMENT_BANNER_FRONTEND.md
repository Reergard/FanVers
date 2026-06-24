# Банер оголошення (Announcement Banner) — Frontend

Дата: 2026-06-24

## Що це

Глобальний банер під хедером для тимчасових оголошень (запуск, оновлення, акції тощо).
Видно на **всіх сторінках** сайту. Користувач може закрити його хрестиком або перейти за посиланням — після цього банер зникає назавжди (до зміни версії).

---

## Файли

```
widgets/announcementBanner/
├── AnnouncementBanner.tsx          ← компонент банера
├── AnnouncementBanner.module.css   ← стилі (адаптив, анімація, крестик)
└── announcementBannerConfig.ts     ← конфіг: текст, посилання, версія, visible
```

Сторінка, на яку веде банер:
```
info/about/
├── behind-the-scenes.tsx           ← сторінка «За лаштунками»
└── AboutPages.module.css           ← стилі сторінки
```

Точка інтеграції: `app/Base.tsx` — між `<Header />` і `<main>`.

---

## Як змінити текст оголошення

Відкрийте файл `widgets/announcementBanner/announcementBannerConfig.ts`:

```ts
export const ANNOUNCEMENT_BANNER_CONFIG = {
  visible: true,          // true — показувати, false — приховати банер повністю
  version: "1",           // ← ГОЛОВНЕ: змініть при кожному оновленні тексту
  title: "Заголовок...",
  message: "Текст оголошення...",
  to: "/behind-the-scenes",    // маршрут для кнопки (React Router)
  linkLabel: "Зазирнути за лаштунки",   // текст на кнопці
};
```

### Як працює версія

- В `localStorage` зберігається ключ `fv:announcement-dismissed` зі значенням версії (наприклад `"1"`)
- Коли користувач закриває банер або натискає кнопку — записується поточна версія
- Якщо `version` у конфізі збігається з тим, що в localStorage — банер не показується
- **Змінили текст → змініть `version` на `"2"`, `"3"` тощо** — банер покажеться всім заново, бо в localStorage стара версія

### Приклад: нове оголошення

```ts
export const ANNOUNCEMENT_BANNER_CONFIG = {
  visible: true,
  version: "2",                          // ← було "1", стало "2"
  title: "Оновлення: нові жанри!",
  message: "Додали 15 нових жанрів...",
  to: "/some-new-page",
  linkLabel: "Дізнатися більше",
};
```

### Як повністю сховати банер

```ts
visible: false,   // банер не рендериться взагалі
```

---

## Коли банер зникає для користувача

Банер зникає (і більше не з'являється) у двох випадках:

1. **Натиснув хрестик (×)** — банер закривається, в `localStorage` записується поточна версія
2. **Натиснув кнопку-посилання** — спрацьовує `dismiss()` + навігація на цільову сторінку

В обох випадках банер не з'явиться знову **навіть після перезавантаження, закриття браузера, наступного дня** — поки не зміниться `version` у конфізі.

---

## Де стоїть банер у DOM

```
<div .app>                    ← Base.tsx
  <Header />
  <AnnouncementBanner />      ← ТУТ (в потоці документа, НЕ fixed/sticky)
  <main>{children}</main>
  <CookieConsentManager />    ← cookie-банер (fixed внизу)
  <Footer />
</div>
```

Банер **в потоці документа** — він зсуває контент вниз. Це відрізняє його від cookie-банера, який `position: fixed` внизу екрана.

---

## Дизайн

- **Фон:** тёмний з легким циановим градієнтом + `backdrop-filter: blur(10px)` (з fallback для Firefox)
- **Шрифт заголовка:** `SofiaSansSemiCondensed` (читабельний, як у секційних заголовках карток)
- **Шрифт тексту:** `Inter`
- **Кнопка:** `ActionButton variant="outline" size="sm"` з пропом `to` (клієнтська навігація)
- **Крестик:** `×` в правому верхньому куті, hover → циановий колір (як в `Modal.tsx`)
- **Анімація:** `slideDown` 280ms при появі, вимикається при `prefers-reduced-motion: reduce`
- **Нижня лінія:** `border-bottom: 1px solid rgba(80, 220, 220, 0.16)`

---

## Адаптив

| Брейкпоінт | Поведінка |
|---|---|
| **Десктоп (>1024px)** | Текст + кнопка в колонку, кнопка по центру, max-width 1280px |
| **Планшет (768–1024px)** | Padding 16px + місце для крестика |
| **Мобільний (≤480px)** | Компактніший padding, кнопка на повну ширину (`fullWidth`) |
| **Маленький мобільний (≤360px)** | Мінімальний padding 8px |
| **Large Desktop (≥1920px)** | max-width 1600px |
| **4K (≥2560px)** | max-width 1680px |

iOS safe-area: `env(safe-area-inset-left/right)` враховано в `padding-inline`.

---

## Пропси компонента

```ts
type AnnouncementBannerProps = {
  title: string;         // заголовок
  message: string;       // текст оголошення
  to: string;            // маршрут для кнопки (React Router Link)
  linkLabel?: string;    // текст кнопки (за замовчуванням "Детальніше")
  visible?: boolean;     // показати/приховати (за замовчуванням true)
  version?: string;      // версія для localStorage (за замовчуванням "1")
};
```

---

## Залежності

- `ActionButton` (`shared/ActionButton/`) — кнопка-посилання
- `useMedia` (`shared/hooks/useMedia`) — визначення мобільного екрану для `fullWidth`
- `localStorage` — збереження стану закриття (з try/catch для приватного режиму)

---

## Зміни в ActionButton

При додаванні банера було внесено одну зміну в `ActionButton.tsx`:
- `<Link>` тепер приймає `onClick` — раніше при використанні `to` проп `onClick` ігнорувався
- Це потрібно щоб при натисканні кнопки банера спрацьовував `dismiss()` перед навігацією
- Не впливає на інші місця використання ActionButton (де `onClick` не передається разом з `to`)

---

## Сторінка «За лаштунками» (/behind-the-scenes)

Інформаційна сторінка в `info/about/behind-the-scenes.tsx`.

**Маршрут:** `/behind-the-scenes` (зареєстрований в `App.tsx`, lazy-loaded)

**Структура:**
- `Container` + `Breadcrumb` (Головна › За лаштунками) + `PageTitle`
- Hero блок (емодзі + заголовок + підзаголовок)
- Intro card (циановий бордер) — привітання
- Секції (тонкий бордер) — про стан платформи, про баги
- CTA card (оранжевий бордер) — як допомогти + кнопка на `/support`
- Підпис команди

**Стилі:** `AboutPages.module.css` — за паттерном `HelpPages.module.css` і `LegalPages.module.css`.

---

## Як додати нову about-сторінку

1. Створити файл в `info/about/` (наприклад `roadmap.tsx`)
2. Використати `AboutPages.module.css` для стилів
3. Додати lazy import + `<Route>` в `App.tsx`
4. За потреби — оновити конфіг банера щоб вести на нову сторінку
