# Cookie consent — Frontend (FanVers)

Дата: 2026-04-02

## 1) Цель и что “реально” выключается

Cookie consent в текущем проекте — это:
- UI-баннер + модалка выбора,
- хранение выбора,
- синхронизация гостевого выбора с аккаунтом,
- “флаги” для будущего контроля необязательных client-side интеграций.

**Что реально зависит от consent:**
- **`Analytics` = true** → загружаются **GA4** (Google Analytics 4) и **Meta Pixel** (Facebook/Instagram). При отключении — скрипты удаляются из DOM. Детали: `SEO_GA4_AND_TRACKING.md`.
- **`Preferences`** — флаг для будущего контроля необязательных UI-настроек (пока не используется).
- **Продуктовая аналитика** (лайки, просмотры, тренды) — это доменная логика backend, она **не зависит** от cookie consent (см. `docs/ANALYTICS_FRONTEND.md`, `backend/docs/ANALYTICS_BOOKS_BACKEND.md`).

## 2) Модель согласия

Минимальная модель без `marketing`:

```ts
CookieConsent = {
  necessary: true,
  preferences: boolean,
  analytics: boolean,
  updated_at?: string
}
```

## 3) Хранение (гость)

Источник истины: `localStorage`.

- Ключ: `cookieConsent`
- Нормализация: мусор в storage игнорируется, `necessary` должен быть `true`.
- Межвкладочная синхронизация: `storage` event.
- Дополнительно: ставится техническая cookie факта consent (`fv_cookie_consent=1`, SameSite=Lax, Secure по протоколу).

Файлы:
- `src/settings/cookieConsentStore.ts`
- `src/settings/useCookieConsent.ts`

## 4) Хранение (авторизованный) и синхронизация

Для авторизованного пользователя consent хранится в БД и зеркалится локально для быстрого UI.

Правило синхронизации при логине:
- если в БД `cookie_consent` пусто, но локально есть — переносим в БД;
- если в БД есть — БД главнее, локальный кэш перезаписываем.

Файл:
- `src/settings/useCookieConsentSync.ts` (подключен глобально через `CookieConsentSyncRoot` в `App.tsx`)

## 5) UI (баннер + модалка)

UI использует существующие компоненты проекта (`Modal`, `ActionButton`) и стили в стиле сайта.

- Баннер показывается только если:
  - `authReady === true` и
  - согласие еще не задано (`consent == null`).
- Кнопки:
  - «Прийняти всі»
  - «Відхилити»
  - «Налаштувати»
- Модалка: переключатели для `preferences` и `analytics`, `necessary` всегда включен.
- В футере есть кнопка “Налаштування cookies”, которая открывает модалку через `window.dispatchEvent` (вне React-дерева).

Файлы:
- `src/widgets/cookieConsent/CookieConsentManager.tsx`
- `src/widgets/cookieConsent/CookieBanner.tsx`
- `src/widgets/cookieConsent/CookieSettingsModal.tsx`
- `src/widgets/cookieConsent/CookieConsentManager.module.css`
- `src/widgets/footer/Footer.tsx` (кнопка “Налаштування cookies”)
- `src/app/Base.tsx` (монтирует `<CookieConsentManager />`)

## 6) API вызовы

Endpoint:
- `GET /api/users/cookie-consent/`
- `PUT /api/users/cookie-consent/`

Файл:
- `src/settings/cookieConsentApi.ts`

Важно:
- запросы идут через общий `http.ts` (Bearer access); `withCredentials` не требуется для этого endpoint.

## 6.1) Troubleshooting (частые симптомы в dev)

### `GET /api/users/cookie-consent/` → 401

Нормально для гостя/до логина: endpoint защищён и требует access-токен.

### `GET /api/users/cookie-consent/` или `GET /api/users/profile/` → 500

Почти всегда означает, что на backend **не применена миграция** для `Profile.cookie_consent`.
Симптом в backend-логе: `column users_profile.cookie_consent does not exist`.

Решение: `python manage.py migrate users` (backend).

### `GET /api/users/cookie-consent/` → 404

Обычно это один из вариантов:
- backend запущен со “старым” кодом/без перезапуска и не подхватил URLConf,
- запросы идут не в тот инстанс backend (другой процесс/порт),
- некорректный dev proxy.

В dev конфиге Vite должен проксировать `/api` на backend (см. `frontend/vite.config.ts`).

## 7) Как правильно применять consent в коде

**Реализовано:**
- GA4 (Google Analytics 4) завантажується тільки при `consent.analytics === true` — див. `src/analytics/AnalyticsProvider.tsx`
- Деталі: **`SEO_GA4_AND_TRACKING.md`**

Правильный паттерн:

- `if (consent.analytics) loadGoogleAnalytics()` ← реалізовано в `AnalyticsProvider`
- `if (consent.analytics) loadMetaPixel()` ← реалізовано в `AnalyticsProvider`
- `if (consent.preferences) persistOptionalUiState()`

Неправильный паттерн:

- `if (!consent.analytics) disableLikes()` (это доменная логика, не cookie‑аналитика)

