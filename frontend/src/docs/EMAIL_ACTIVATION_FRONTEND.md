# Email-активация Frontend

## Обзор

Описывает поток подтверждения email после регистрации: юзер получает письмо со ссылкой `https://fan-vers.com/activate/<uid>/<token>`, кликает — фронт отправляет токен на бекенд, аккаунт становится `is_active=True`, далее юзер может войти.

**Текущий статус:** инфраструктура (Brevo SMTP, Cloudflare Email Routing, DNS, DKIM) на бекенде готова и протестирована. Сама страница активации на фронте **ещё не реализована** — этот файл описывает что и как сделать.

## Связанные файлы на бекенде

- `backend/docs/EMAIL_SYSTEM_BACKEND.md` — настройки Brevo/Cloudflare, DNS.
- `backend/apps/users/api/views.py` — `RegisterView` (нужно добавить отправку activation email).
- `backend/FanVers_project/settings.py` — `DJOSER['ACTIVATION_URL'] = 'activate/{uid}/{token}'`.
- Djoser-эндпоинт для активации: `POST /api/auth/users/activation/` с телом `{uid, token}`.

## Что нужно сделать на фронте

### 1. Роут `/activate/:uid/:token`

Добавить в `App.tsx` (или где у тебя `<Routes>`) маршрут:

```tsx
<Route path="/activate/:uid/:token" element={<ActivateAccountPage />} />
```

### 2. Компонент `ActivateAccountPage`

Логика:
1. Взять `uid` и `token` из `useParams()`.
2. При монтировании — `POST /api/auth/users/activation/` с телом `{ uid, token }`.
3. Отслеживать 3 состояния: `loading` / `success` / `error`.
4. На `success` — показать сообщение «Email подтверждён», через 2-3 сек редирект на `/` или на страницу логина.
5. На `error` — показать сообщение с кнопкой «Отправить ссылку повторно» (см. пункт 3).

Примерный скелет:
```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { httpRaw } from '@/api/httpRaw';

export function ActivateAccountPage() {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    httpRaw.post('/api/auth/users/activation/', { uid, token })
      .then(() => {
        setState('success');
        setTimeout(() => navigate('/'), 2500);
      })
      .catch((e) => {
        setState('error');
        setErrorMsg(e.response?.data?.detail ?? 'Токен недействителен или уже использован');
      });
  }, [uid, token, navigate]);

  // рендер по state
}
```

Используется `httpRaw` (без JWT-интерцепторов), так как юзер ещё не залогинен.

### 3. Компонент «Отправить ссылку повторно»

Для кейса, когда письмо не пришло / токен истёк. Djoser эндпоинт: `POST /api/auth/users/resend_activation/` с телом `{ email }`.

Размещение: на странице логина (если юзер пытается войти с неактивированным аккаунтом — бекенд возвращает 403 «Аккаунт не активирован»), и на странице ошибки активации.

### 4. Обработка ошибки «неактивный аккаунт» при логине

`LoginView` на бекенде при `is_active=False` возвращает `403 {"detail": "Аккаунт не активирован..."}`. Фронт должен:
- Поймать 403 после login.
- Показать модалку с текстом «Подтвердите email. Проверьте почту или отправьте ссылку повторно».
- Кнопка «Отправить повторно» → `/api/auth/users/resend_activation/`.

### 5. UX регистрации

Сейчас после успешной регистрации `RegisterView` возвращает либо:
- 201 + `{user, access}` если `is_active=True` (автоматический вход),
- 201 + `{detail: "Реєстрація успішна. Підтвердіть email для входу."}` если `is_active=False`.

Фронт в `auth/service.ts` (`registerSession`) должен проверять: есть ли в ответе `access` — значит залогинены, иначе показать экран «Проверьте почту» с инструкцией.

## Ссылки из письма

Djoser использует `ACTIVATION_URL = 'activate/{uid}/{token}'`. Полный URL в письме строится как:

```
https://fan-vers.com/activate/<uid>/<token>
```

Где:
- `uid` — base64-encoded ID юзера (djoser сам генерит).
- `token` — токен от `PasswordResetTokenGenerator` (djoser сам генерит).

Время жизни токена — по умолчанию 3 дня (настройка `PASSWORD_RESET_TIMEOUT` в Django).

## Проверка end-to-end

После реализации:
1. Зарегистрировать юзера с реальной почтой.
2. На почту должно прийти письмо от `info@fan-vers.com` с темой «Account activation on FanVers» (или аналогичной — кастомный шаблон можно положить в `backend/templates/email/activation.html`).
3. Клик по ссылке → фронт открывает `/activate/<uid>/<token>` → POST на `/api/auth/users/activation/` → 204 No Content.
4. Редирект на `/`.
5. Пробовать логин — работает.
6. В Brevo → **Transactional → Email Activity** статус `Delivered` + `Click`.

## Возможные улучшения (опционально)

- **Кастомный шаблон письма.** Сейчас djoser использует дефолтный шаблон — выглядит сухо. Положить свой `backend/templates/email/activation.html` с брендингом FanVers.
- **Счётчик попыток** для `resend_activation` (anti-spam). На бекенде уже есть throttling через `ScopedRateThrottle`, но можно добавить фронт-UI «подождите X секунд».
- **Welcome email** после успешной активации (необязательно, но даёт хороший UX).

## Почему это критично

Сейчас юзеры, регистрирующиеся через форму (не через OAuth), создаются с `is_active=False`, письмо не отправляется (код отправки не добавлен в `RegisterView`), и войти они не могут — тупик. OAuth-юзеры (Google/Facebook) работают нормально благодаря `social_pipeline.activate_social_user`.

Реализация этой страницы + добавление 1-2 строк в `RegisterView` закрывает регистрацию через email.
