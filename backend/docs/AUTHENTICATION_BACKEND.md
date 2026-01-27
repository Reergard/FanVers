# Авторизация Backend

## Обзор
- Access JWT возвращается в ответе и проверяется через `Authorization: Bearer`.
- Refresh JWT хранится только в HttpOnly cookie `refresh_token`.
- CSRF обязателен для `refresh/logout`, а `login/register` исключены из CSRF.

## Потоки токенов
- **Login/Register**: создаются `access` и `refresh`, refresh пишется в cookie, access возвращается в теле ответа.
- **Refresh**: читает refresh cookie, валидирует, пытается занести старый токен в blacklist, выдает новый refresh + access.
- **Logout**: при наличии refresh cookie пытается blacklist, затем удаляет refresh cookie.

## CSRF и cookies
- CSRF токен выдается через `GET /api/users/csrf/` и используется в `X-CSRFToken`.
- `refresh/logout` требуют CSRF и `withCredentials`.
- Параметры refresh cookie берутся из `CSRF_COOKIE_SAMESITE` и `SESSION_COOKIE_DOMAIN`, `secure` зависит от `DEBUG`.

## Настройки и правила
- `REST_FRAMEWORK.DEFAULT_AUTHENTICATION_CLASSES`: JWT всегда, Session только в `DEBUG`.
- `ALLOWED_HOSTS`: локальные дефолты в `DEBUG`, строгие домены в проде.
- `SIMPLE_JWT`: ротация делается вручную в refresh view (`ROTATE_REFRESH_TOKENS=False`, `BLACKLIST_AFTER_ROTATION=False`).
- `rest_framework_simplejwt.token_blacklist` включен, миграции обязательны для работы blacklist.

## Файлы и ответственность
- `backend/apps/users/api/views.py`: login/register/refresh/logout/csrf, параметры refresh cookie.
- `backend/apps/users/middleware.py`: auth‑логирование только в `DEBUG`.
- `backend/apps/api/exc_handlers.py`: лог заголовков 403 только в `DEBUG`.
- `backend/FanVers_project/settings.py`: auth/CSRF/cookie/hosts и DRF настройки.

## Безопасность
- Refresh токен доступен только серверу (HttpOnly cookie).
- Логи с токенами/куками/заголовками отключены в проде.
- CSRF обязателен для операций с refresh cookie.
