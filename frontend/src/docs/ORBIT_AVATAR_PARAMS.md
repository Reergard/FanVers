# Параметри орбіти та аватарки в меню користувача

## Брейкпоінт PC vs Mobile

- **1024px та менше** → `drawer` (мобільна/планшетна версія)
- **1025px та більше** → `popover` (ПК/ноутбук)

Джерело: `Header.tsx` → `useMedia("(max-width: 1024px)")` → `mode = isMobile ? "drawer" : "popover"`

---

## 1. Орбіта неавторизованого гостя (Вхід / Реєстрація)

**Файл:** `UserMenuOverlay.module.css`  
**Контейнер:** `.guestOrbit`  
**Компонент:** `AvatarOrbit` з `variant="fullWidth"`

### Параметри контейнера (.guestOrbit)

| Параметр | Значення | Опис |
|----------|----------|------|
| `--guest-padding` | `clamp(16px, calc(2.2 * var(--vwu)), 22px)` | Відступ для розрахунку ширини |
| `width` | `calc(100% + 2 * var(--guest-padding))` | Ширина = контент + компенсація padding |
| `margin-left` | `calc(-1 * var(--guest-padding))` | Зсув вліво — притиснути до лівого краю |
| `margin-top` | `0` | Без відступу зверху |
| `margin-bottom` | `clamp(6px, calc(1.2 * var(--vwu)), 10px)` | Відступ знизу до кнопок |
| `overflow` | `hidden` | Обрізає виступаючу орбіту |

### Панель (.panelPopover для PC)

| Параметр | Значення |
|----------|----------|
| `width` | `clamp(260px, calc(22 * var(--vwu)), 320px)` |
| `max-width` | `min(calc(82 * var(--vwu)), 400px)` |
| `max-height` | `min(790px, 100dvh)` |

### Панель (.panelDrawer для mobile)

| Параметр | Значення |
|----------|----------|
| `width` | `clamp(240px, calc(72 * var(--vwu)), 320px)` |
| `max-width` | `min(calc(85 * var(--vwu)), 400px)` |

---

## 2. Орбіта авторизованого користувача (Закладки, налаштування…)

**Файл:** `MenuPanel.module.css`  
**Контейнер:** `.avatarOrbit`  
**Компонент:** `AvatarOrbit` з `variant="fullWidth"`

### Параметри контейнера (.avatarOrbit)

| Параметр | Значення | Опис |
|----------|----------|------|
| `--panel-padding-inline` | `clamp(18px, calc(2.5 * var(--vwu)), 26px)` | Горизонтальний padding панелі |
| `width` | `calc(100% + 2 * var(--panel-padding-inline))` | Притиснута до країв |
| `margin-left` | `calc(-1 * var(--panel-padding-inline))` | Зсув вліво |
| `margin-top` | `0` |
| `margin-bottom` | `0` |
| `overflow` | `hidden` |

### Залежності

- `nameSection` margin-top: `clamp(-70px, calc(-6 * var(--vwu)), -85px)` — нік над орбітою
- `ctaSection` margin-top: `clamp(16px, calc(2.5 * var(--vwu)), 28px)`
- `menuSection` margin-top: `auto`

---

## 3. AvatarOrbit (спільний компонент)

**Файл:** `AvatarOrbit.module.css`

### .orbitContainer (базово)

| Параметр | Значення |
|----------|----------|
| `aspect-ratio` | `399 / 583` |
| `max-height` (не fullWidth) | `min(26dvh, 165px)` |

### .orbitFullWidth (variant="fullWidth")

| Параметр | Значення |
|----------|----------|
| `max-height` | `none` |
| `width` | `100%` |

### .orbitSvg, .orbitSvg svg

| Параметр | Значення |
|----------|----------|
| `max-height` (default) | `min(26dvh, 165px)` |
| `max-height` (fullWidth) | `none` |

### .avatar (розмір аватарки)

| Параметр | Значення |
|----------|----------|
| `width`, `height` | `clamp(119px, calc(10.5 * var(--vwu)), 119px)` |
| `avatar::before` inset | `-28px` (ореол) |
| `avatar::after` | box-shadow (кільце) |

---

## Прив'язки до viewBox SVG

- `menu_line.svg` viewBox: 399×583
- Центр аватарки в SVG: `top: 49%`, `left: 50%`, `transform: translate(-50%, -50%)`

---

## Зменшення орбіти тільки для ПК (без впливу на мобільні)

**Брейкпоінт:** `@media (min-width: 1025px)` — спрацьовує лише на ПК/ноутбуках.

### Гостьове меню (.guestOrbit)

- `transform: scale(0.78)`
- `transform-origin: center top`
- Селектор: `.panelPopover .guestOrbit`

### Авторизоване меню (.avatarOrbit)

- `transform: scale(0.78)`
- `transform-origin: center top`
- Застосовується в межах `MenuPanel.module.css` тільки при viewport ≥ 1025px.

Логіка притиснення до країв (negative margin, width calc) збережена; мобільні версії (drawer) не змінені.
