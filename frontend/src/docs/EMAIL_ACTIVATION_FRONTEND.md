# Email-активация Frontend

## Обзор

Описывает поток подтверждения email после регистрации: юзер получает письмо со ссылкой `https://fan-vers.com/activate/<uid>/<token>`, кликает — фронт отправляет токен на бекенд, аккаунт становится `is_active=True`, далее юзер может войти.

**Текущий статус:** реализовано полностью — письмо отправляется из `RegisterView`,
фронт имеет роут `/activate/:uid/:token` (компонент `ActivateAccountPage`), `LoginForm`
обрабатывает 403 и предлагает повторную отправку. Далее описана архитектура решения
для сопровождения.

Дополнительно реализованы маршруты сброса пароля / логина по ссылкам из писем djoser:

- `/password/reset` — запрос письма со ссылкой
- `/password/reset/confirm/:uid/:token` — установка нового пароля
- `/username/reset/confirm/:uid/:token` — установка нового логина

## Связанные файлы на бекенде

- `backend/docs/EMAIL_SYSTEM_BACKEND.md` — настройки Brevo/Cloudflare, DNS, `DOMAIN`, активация.
- `backend/apps/users/api/views.py` — `RegisterView` (отправка activation email для `is_active=False`).
- `backend/FanVers_project/settings.py` — `DJOSER['ACTIVATION_URL']`, сброс пароля/логина, `DOMAIN`.
- Djoser: `POST /api/auth/users/activation/` с телом `{uid, token}`; `POST /api/auth/users/resend_activation/` с `{email}`.

## Реализация на фронте

### 1. Роут `/activate/:uid/:token`

В `frontend/src/App.tsx`:

```tsx
<Route path="/activate/:uid/:token" element={<ActivateAccountPage />} />
```

### 2. Компонент `ActivateAccountPage`

Файл: `frontend/src/auth/ActivateAccountPage.tsx`.

- `useParams()` → `uid`, `token`.
- При монтировании: `httpRaw.post(API.activateAccount, { uid, token })`.
- Состояния: `loading` / `success` / `error`.
- На `success` — сообщение и редирект на `/`.
- На `error` — текст ошибки, поле email и кнопка повторной отправки через `resendActivation()` из `frontend/src/auth/activationApi.ts`.

### 3. Повторная отправка письма активации

`POST /api/auth/users/resend_activation/` с `{ email }` — обёртка `resendActivation(email)` в `activationApi.ts`.

Используется в `LoginForm` (после 403 «не активирован») и на странице ошибки активации.

### 4. Ошибка «неактивный аккаунт» при логине

`LoginView` возвращает `403` и `{"detail": "..."}`. В `LoginForm` отдельная ветка по `status === 403`: показ баннера и кнопка «Надіслати лист повторно» (email запрашивается через `prompt`).

### 5. UX регистрации (реализовано)

`RegisterForm.tsx` после `registerSession()` проверяет:

- `result?.access` присутствует → пользователь автоматически залогинен → «Реєстрація успішна! Ви увійшли в систему.»
- `result?.access` отсутствует (только `result?.detail`) → нужна активация → показываем `result.detail` или fallback «перевірте пошту».

## Ссылки из письма

Djoser: `ACTIVATION_URL = 'activate/{uid}/{token}'`. В кастомном шаблоне ссылки собраны как `https://{{ domain }}/{{ url }}` (не зависят от `protocol` из контекста djoser).

## Проверка end-to-end

1. Зарегистрировать юзера с реальной почтой.
2. Письмо от `info@fan-vers.com` с темой/телом из `backend/templates/email/activation.html`.
3. Клик → `/activate/<uid>/<token>` → `POST /api/auth/users/activation/` → успех.
4. Редирект на `/`, вход с паролем.
5. В Brevo → **Transactional → Email Activity** — `Delivered` / `Click`.

## Возможные улучшения (опционально)

- Welcome email после первой сессии.
- Счётчик/бэкенд-throttle для `resend_activation` (на фронте уже есть короткий cooldown после успеха).

## Документация по сбросу пароля

После добавления роутов `/password/reset` и confirm-страниц ссылки из писем djoser (`PASSWORD_RESET_CONFIRM_URL` и т.д.) ведут на фронт, а не на 404.
