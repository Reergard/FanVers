# Cookie consent — Backend (FanVers)

Дата: 2026-04-02

## 1) Модель данных

Хранение сделано **в профиле пользователя**, без отдельного приложения и без отдельной сложной модели.

- Модель: `apps.users.models.Profile`
- Поле: `Profile.cookie_consent` (JSONField, `null=True`, `blank=True`)

Пример значения:

```json
{
  "necessary": true,
  "preferences": false,
  "analytics": false,
  "updated_at": "2026-04-02T12:34:56Z"
}
```

Примечания:
- `necessary` **всегда** `true` (это enforced).
- `updated_at` проставляется **сервером**, чтобы у нас был timestamp источника истины.

## 2) API

Эндпоинт для текущего пользователя:

- `GET /api/users/cookie-consent/`
  - Auth: `Authorization: Bearer <access>`
  - Ответ: `{ "cookie_consent": <object|null> }`

- `PUT /api/users/cookie-consent/`
  - Auth: `Authorization: Bearer <access>`
  - Body:

```json
{ "necessary": true, "preferences": false, "analytics": false }
```

  - Сервер:
    - валидирует `necessary === true`,
    - сохраняет `cookie_consent` с `updated_at`,
    - выполняет `profile.save(update_fields=["cookie_consent"])`.

## 3) Валидация

Валидация вынесена в `CookieConsentSerializer`:
- `necessary` должен быть `true`
- `preferences`/`analytics` — booleans
- `to_storage_value()` формирует объект для БД и добавляет `updated_at`

## 4) Throttling

`CookieConsentView` использует scoped throttling:
- `throttle_scope = "profile"`

Убедитесь, что в `FanVers_project/settings.py` задан лимит:
- `REST_FRAMEWORK.DEFAULT_THROTTLE_RATES["profile"]`

## 5) Миграции и ожидаемые статусы

### Миграция обязательна

Поле `Profile.cookie_consent` добавляется миграцией `users.0003_profile_cookie_consent`.

Если миграция **не применена**, любые запросы, которые сериализуют профиль (включая `GET /api/users/profile/` и `GET /api/users/cookie-consent/`), могут падать **500** с ошибкой вида:

- `django.db.utils.ProgrammingError: column users_profile.cookie_consent does not exist`

Команда для применения:

- `python manage.py migrate users`

### Ожидаемое поведение без авторизации

`CookieConsentView` защищён `IsAuthenticated`, поэтому:

- `GET /api/users/cookie-consent/` без access-токена ожидаемо возвращает **401** (это нормально и не является ошибкой сервера).

## 5) Почему это не “отключает аналитику продукта”

Этот endpoint хранит **только выбор пользователя** и предназначен для контроля **необязательных client-side интеграций** (например, GA/Pixel/Hotjar, внешние embeds), если они появятся.

Он **не должен** выключать доменные действия (лайки/рейтинги/ТОП), потому что это продуктовая логика и серверная статистика (см. `backend/docs/ANALYTICS_BOOKS_BACKEND.md` и `frontend/src/info/legal/cookie-policy.tsx`).

