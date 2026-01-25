# Система авторизации FanVers

## 📋 Содержание

1. [Общая архитектура](#общая-архитектура)
2. [Типы токенов](#типы-токенов)
3. [Cookie-based Refresh токены](#cookie-based-refresh-токены)
4. [CSRF защита](#csrf-защита)
5. [Эндпоинты авторизации](#эндпоинты-авторизации)
6. [Логика работы](#логика-работы)
7. [Безопасность](#безопасность)
8. [Расположение кода](#расположение-кода)
9. [Настройки](#настройки)
10. [Важные моменты](#важные-моменты)

---

## Общая архитектура

Система авторизации использует **JWT (JSON Web Tokens)** с гибридным подходом:

- **Access токен** — передается в заголовке `Authorization: Bearer <token>`
  - Короткоживущий (15 минут)
  - Используется для доступа к защищенным эндпоинтам
  - Хранится только в памяти приложения (переменная/store), **НЕ** в localStorage/sessionStorage

- **Refresh токен** — передается через **HttpOnly cookie**
  - Долгоживущий (7 дней)
  - Используется только для обновления access токена
  - Недоступен для JavaScript (защита от XSS)

### Почему именно так?

1. **HttpOnly cookie для refresh** — защита от XSS атак (JavaScript не может прочитать refresh токен)
2. **Access токен в заголовке** — стандартный подход для REST API, легко отзывается
3. **Разделение ответственности** — access для авторизации, refresh только для обновления
4. **CSRF защита** — refresh эндпоинты защищены CSRF токенами

---

## Типы токенов

### Access Token

**Назначение:** Авторизация запросов к защищенным эндпоинтам

**Характеристики:**
- Время жизни: **15 минут**
- Формат: JWT (JSON Web Token)
- Алгоритм: HS256
- Передача: `Authorization: Bearer <token>`
- Хранение: Память фронтенда (не в cookie!)

**Пример использования:**
```http
GET /api/users/profile/
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

### Refresh Token

**Назначение:** Обновление access токена

**Характеристики:**
- Время жизни: **7 дней**
- Формат: JWT (JSON Web Token)
- Передача: HttpOnly cookie `refresh_token`
- Хранение: Браузер (HttpOnly cookie)
- Ротация: При каждом обновлении создается новый refresh токен, старый попадает в blacklist

**Параметры cookie:**
- `HttpOnly: true` — JavaScript не может прочитать
- `Secure: true` (в проде) — только через HTTPS
- `SameSite: None/Lax` — зависит от настроек (кросс-сайт или same-site)
- `Domain: .fan-vers.com` (в проде) — работает для www и apex домена
- `Path: /` — доступна всему сайту
- `Max-Age: 604800` (7 дней)

---

## Cookie-based Refresh токены

### Почему cookie, а не body?

1. **Безопасность** — HttpOnly cookie недоступна для JavaScript (защита от XSS)
2. **Автоматическая отправка** — браузер автоматически отправляет cookie с каждым запросом
3. **CSRF защита** — можно защитить через CSRF токены

### Реализация

**Файл:** `backend/apps/users/api/views.py`

**Функции:**
- `_cookie_params()` — формирует параметры cookie в зависимости от DEBUG/PROD
- `set_refresh_cookie(response, refresh_str)` — устанавливает refresh cookie
- `del_refresh_cookie(response)` — удаляет refresh cookie

**Важно:** Параметры cookie должны совпадать с CSRF cookie настройками в `settings.py`:
- `secure` — только HTTPS в проде
- `samesite` — совпадает с `CSRF_COOKIE_SAMESITE`
- `domain` — совпадает с `CSRF_COOKIE_DOMAIN` (в проде)

---

## CSRF защита

### Что защищено CSRF?

**Защищены (требуют CSRF токен):**
- `POST /api/users/refresh/` — обновление токенов
- `POST /api/users/logout/` — выход из системы

**Важно:** CSRF обязателен для эндпоинтов, которые используют refresh-cookie (refresh/logout). Остальные запросы обычно используют Bearer access токен в заголовке `Authorization` и не требуют CSRF.

**Не защищены (csrf_exempt):**
- `POST /api/users/login/` — вход (не использует cookie)
- `POST /api/users/register/` — регистрация (не использует cookie)

### Как работает CSRF защита?

1. **CsrfViewMiddleware** — проверяет CSRF токен для всех POST/PUT/PATCH/DELETE запросов
2. **CSRF токен** — получается через `GET /api/users/csrf/`
3. **Передача токена** — в заголовке `X-CSRFToken: <token>`
4. **Cookie csrftoken** — устанавливается автоматически Django при первом запросе

### Настройки CSRF

**Файл:** `backend/FanVers_project/settings.py`

```python
# CSRF cookie настройки
CSRF_COOKIE_HTTPONLY = False  # JavaScript должен читать токен
CSRF_USE_SESSIONS = False     # Используем cookies, не сессии

# В проде
CSRF_COOKIE_SECURE = True     # Только HTTPS
CSRF_COOKIE_DOMAIN = ".fan-vers.com"  # Работает для www и apex
CSRF_COOKIE_SAMESITE = 'None'  # Кросс-сайт (для Telegram/WebView)
```

**Важно:** `CSRF_COOKIE_HTTPONLY = False` — CSRF cookie доступна JavaScript при необходимости. Фронтенд получает CSRF token через `GET /api/users/csrf/` (бекенд использует `get_token(request)` внутри) и отправляет его в заголовке `X-CSRFToken` для защищенных запросов.

---

## Эндпоинты авторизации

### 1. Регистрация

**Эндпоинт:** `POST /api/users/register/`

**Описание:** Создание нового пользователя

**CSRF:** Не требуется (`csrf_exempt`)

**Запрос:**
```json
{
  "username": "user123",
  "email": "user@example.com",
  "password": "secure_password",
  "re_password": "secure_password"
}
```

**Ответ:**
```json
{
  "user": {
    "id": 1,
    "username": "user123",
    "email": "user@example.com"
  },
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Cookie:** Устанавливается `refresh_token` (HttpOnly)

**Особенности:**
- Пользователь создается с `is_active=False` если `SEND_ACTIVATION_EMAIL=True`
- Email активация через Djoser
- **Токены выдаются сразу после регистрации** (access токен и refresh cookie)
- **Но доступ к логину/нормальной работе блокируется** — при попытке входа через `POST /api/users/login/` будет возвращен 403, пока аккаунт не активирован через email
- После подтверждения email пользователь может полноценно использовать систему

**Код:** `backend/apps/users/api/views.py` → `RegisterView`

---

### 2. Вход

**Эндпоинт:** `POST /api/users/login/`

**Описание:** Аутентификация пользователя

**CSRF:** Не требуется (`csrf_exempt`)

**Throttling:** `auth_login` — 5 запросов в минуту

**Запрос:**
```json
{
  "username": "user123",
  "password": "secure_password"
}
```

**Ответ:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Cookie:** Устанавливается `refresh_token` (HttpOnly)

**Проверки:**
1. Валидация username/password через `authenticate()`
2. **Проверка `user.is_active`** — если `False`, возвращается 403 с сообщением "Аккаунт не активирован"
3. Генерация access и refresh токенов
4. Установка refresh cookie

**Код:** `backend/apps/users/api/views.py` → `LoginView`

---

### 3. Обновление токенов

**Эндпоинт:** `POST /api/users/refresh/`

**Описание:** Обновление access токена через refresh cookie

**CSRF:** **Требуется** (защищен CSRF)

**Throttling:** `auth_refresh` — 30 запросов в минуту

**Запрос:**
```http
POST /api/users/refresh/
X-CSRFToken: <csrf_token>
Cookie: refresh_token=<refresh_token>
```

**Ответ:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Cookie:** Обновляется `refresh_token` (новый refresh токен)

**Логика:**
1. Проверка CSRF токена (Django middleware)
2. Извлечение refresh токена из cookie
3. Валидация refresh токена
4. **Ротация:** старый refresh токен добавляется в blacklist
5. Создание нового refresh и access токенов
6. Установка нового refresh cookie

**Код:** `backend/apps/users/api/views.py` → `CookieTokenRefreshView`

---

### 4. Выход

**Эндпоинт:** `POST /api/users/logout/`

**Описание:** Выход из системы, удаление refresh токена

**CSRF:** **Требуется** (защищен CSRF)

**Throttling:** `auth_logout` — 20 запросов в минуту

**Запрос:**
```http
POST /api/users/logout/
X-CSRFToken: <csrf_token>
Cookie: refresh_token=<refresh_token>
```

**Ответ:** `205 Reset Content`

**Cookie:** Удаляется `refresh_token`

**Логика:**
1. Проверка CSRF токена
2. Извлечение refresh токена из cookie
3. Добавление refresh токена в blacklist
4. Удаление refresh cookie

**Код:** `backend/apps/users/api/views.py` → `LogoutView`

---

### 5. Проверка статуса авторизации

**Эндпоинт:** `GET /api/users/auth-status/`

**Описание:** Проверка, авторизован ли пользователь

**CSRF:** Не требуется (GET запрос)

**Аутентификация:** **Требуется** (`IsAuthenticated` + `JWTAuthentication`)

**Запрос:**
```http
GET /api/users/auth-status/
Authorization: Bearer <access_token>
```

**Ответ (если авторизован):**
```json
{
  "isAuthenticated": true
}
```

**Ответ (если не авторизован):**
```
401 Unauthorized
```

**Важно:** 
- Эндпоинт требует валидный access токен
- Если токена нет или он истек → 401
- Фронтенд должен обработать 401 и сделать refresh

**Код:** `backend/apps/users/api/views.py` → `AuthStatusView`

---

### 6. Получение CSRF токена

**Эндпоинт:** `GET /api/users/csrf/`

**Описание:** Получение CSRF токена для защищенных запросов

**CSRF:** Не требуется (GET запрос)

**Запрос:**
```http
GET /api/users/csrf/
```

**Ответ:**
```json
{
  "csrfToken": "abc123def456..."
}
```

**Cookie:** Устанавливается `csrftoken` (если еще не установлена)

**Использование:**
1. Фронтенд вызывает при загрузке приложения
2. Сохраняет токен в памяти
3. Отправляет в заголовке `X-CSRFToken` для всех POST/PUT/PATCH/DELETE запросов

**Код:** `backend/apps/users/api/views.py` → `get_csrf_token`

---

## Логика работы

### Типичный flow авторизации

#### 1. Регистрация
```
1. POST /api/users/register/ → создается пользователь с is_active=False
2. Устанавливается refresh_token cookie
3. Возвращается access токен
4. Пользователь получает токены, но при попытке входа через login будет 403
5. После подтверждения email (через Djoser activation) → is_active=True
6. Теперь пользователь может полноценно использовать систему
```

#### 2. Вход
```
1. POST /api/users/login/ → проверка username/password
2. Проверка is_active (если False → 403)
3. Устанавливается refresh_token cookie
4. Возвращается access токен
```

#### 3. Работа с API
```
1. Фронтенд отправляет запросы с Authorization: Bearer <access_token>
2. Если токен валиден → запрос выполняется
3. Если токен истек → 401 Unauthorized
```

#### 4. Обновление токена (при 401)
```
1. Фронтенд получает 401
2. POST /api/users/refresh/ с X-CSRFToken и refresh_token cookie
3. Сервер валидирует refresh токен
4. Старый refresh токен → blacklist
5. Новый refresh токен → cookie
6. Новый access токен → в ответе
7. Фронтенд повторяет оригинальный запрос с новым access токеном
```

#### 5. Выход
```
1. POST /api/users/logout/ с X-CSRFToken и refresh_token cookie
2. Refresh токен → blacklist
3. Refresh cookie → удаляется
4. Фронтенд очищает access токен из памяти
```

### Проверка статуса авторизации

```
1. GET /api/users/auth-status/ с Authorization: Bearer <access_token>
2. Если токен валиден → {"isAuthenticated": true}
3. Если токен истек/отсутствует → 401
4. При 401 → refresh → повторный auth-status
```

---

## Безопасность

### Защита от XSS

- **Refresh токен в HttpOnly cookie** — JavaScript не может прочитать
- **Access токен в памяти приложения** — хранится только в переменной/store, **НЕ** в localStorage/sessionStorage (защита от XSS)

### Защита от CSRF

- **CSRF токены** для всех операций с refresh cookie
- **SameSite cookie** — дополнительная защита (настраивается в settings)
- **Проверка origin** через CORS (белый список доменов)

### Защита от перехвата токенов

- **HTTPS в проде** — все cookie с `Secure: true`
- **Короткоживущие access токены** — 15 минут
- **Ротация refresh токенов** — при каждом обновлении новый токен
- **Blacklist** — старые refresh токены недействительны

### Защита от брутфорса

- **Throttling** на эндпоинты авторизации:
  - `auth_login`: 5 запросов/минуту
  - `auth_refresh`: 30 запросов/минуту
  - `auth_logout`: 20 запросов/минуту

### Проверка активации аккаунта

- **Email активация** — пользователь с `is_active=False` не может войти
- **Проверка в LoginView** — явная проверка `user.is_active` перед выдачей токенов
- **OAuth провайдеры** (Google/Facebook) — создают пользователей с `is_active=True` (email уже подтвержден)

---

## Расположение кода

### Основные файлы

#### Views (логика авторизации)
**Файл:** `backend/apps/users/api/views.py`

**Классы и функции:**
- `RegisterView` — регистрация пользователя
- `LoginView` — вход в систему
- `CookieTokenRefreshView` — обновление токенов
- `LogoutView` — выход из системы
- `AuthStatusView` — проверка статуса авторизации
- `get_csrf_token` — получение CSRF токена
- `set_refresh_cookie()` — установка refresh cookie
- `del_refresh_cookie()` — удаление refresh cookie
- `_cookie_params()` — параметры cookie

#### URLs (маршрутизация)
**Файл:** `backend/apps/users/api/urls.py`

**Эндпоинты:**
- `/api/users/register/` → `RegisterView`
- `/api/users/login/` → `LoginView`
- `/api/users/refresh/` → `CookieTokenRefreshView`
- `/api/users/logout/` → `LogoutView`
- `/api/users/auth-status/` → `AuthStatusView`
- `/api/users/csrf/` → `get_csrf_token`

**Файл:** `backend/apps/api/urls.py`

**Включает:**
- `path('auth/', include('djoser.urls'))` — Djoser эндпоинты (password reset, activation)
- `path('users/', include('apps.users.api.urls'))` — пользовательские эндпоинты

#### Settings (настройки)
**Файл:** `backend/FanVers_project/settings.py`

**Секции:**
- `REST_FRAMEWORK` — настройки DRF (authentication, permissions, throttling)
- `SIMPLE_JWT` — настройки JWT токенов
- `DJOSER` — настройки Djoser (email активация, password reset)
- `CORS_*` — настройки CORS
- `CSRF_*` — настройки CSRF cookie

#### Serializers
**Файл:** `backend/apps/users/api/serializers.py`

**Сериализаторы:**
- `CreateUserSerializer` — создание пользователя (используется в RegisterView)
- `CurrentUserSerializer` — текущий пользователь

---

## Настройки

### JWT настройки

**Файл:** `backend/FanVers_project/settings.py` → `SIMPLE_JWT`

```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),  # 15 минут
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),     # 7 дней
    'ROTATE_REFRESH_TOKENS': False,                   # Ротация вручную
    'BLACKLIST_AFTER_ROTATION': False,                # Blacklist вручную
    'AUTH_HEADER_TYPES': ('Bearer',),                # Только Bearer
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SIGNING_KEY,
}
```

**Важно:**
- `ROTATE_REFRESH_TOKENS: False` — ротация делается вручную в `CookieTokenRefreshView`
- `BLACKLIST_AFTER_ROTATION: False` — blacklist делается вручную

### CORS настройки

**Файл:** `backend/FanVers_project/settings.py`

```python
# DEBUG режим
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = False  # Белый список даже в DEBUG
    CORS_ALLOWED_ORIGINS = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        # ...
    ]

# PROD режим
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = [
        "https://fan-vers.com",
        "https://www.fan-vers.com",
    ]

CORS_ALLOW_CREDENTIALS = True  # Для cookie
```

**Важно:**
- `CORS_ALLOW_ALL_ORIGINS = False` даже в DEBUG — для дисциплины и контроля
- WebSocket origins (`ws://`, `wss://`) не должны быть в `CORS_ALLOWED_ORIGINS` (проверяются отдельно Channels/ASGI)

### CSRF настройки

**Файл:** `backend/FanVers_project/settings.py`

```python
# Общие настройки
CSRF_COOKIE_HTTPONLY = False  # JavaScript должен читать токен
CSRF_USE_SESSIONS = False      # Используем cookies

# PROD настройки
if not DEBUG:
    CSRF_COOKIE_SECURE = True     # Только HTTPS
    CSRF_COOKIE_DOMAIN = ".fan-vers.com"  # Для www и apex
    # Нормализация значения из env
    raw = os.getenv('CSRF_COOKIE_SAMESITE', 'None')
    raw = (raw or '').strip().lower()
    CSRF_COOKIE_SAMESITE = 'None' if raw == 'none' else 'Lax'
```

**Важно:**
- `CSRF_COOKIE_HTTPONLY = False` — фронтенд должен читать токен для отправки в заголовке
- Нормализация `CSRF_COOKIE_SAMESITE` — любые варианты `none`/`NONE`/`None` → `'None'`

### Djoser настройки

**Файл:** `backend/FanVers_project/settings.py` → `DJOSER`

```python
DJOSER = {
    'SEND_ACTIVATION_EMAIL': True,  # Email активация
    'ACTIVATION_URL': 'activate/{uid}/{token}',
    'LOGIN_FIELD': 'username',
    'USER_CREATE_PASSWORD_RETYPE': True,
    # ...
}
```

**Важно:**
- `SEND_ACTIVATION_EMAIL: True` — пользователи создаются с `is_active=False`
- После регистрации требуется подтверждение email
- `LoginView` проверяет `user.is_active` перед выдачей токенов

---

## Важные моменты

### 1. Почему не используется Djoser JWT?

**Проблема:** Djoser предоставляет свои JWT эндпоинты (`djoser.urls.jwt`), которые используют стандартный refresh через body.

**Решение:** Используется только `djoser.urls` (для password reset, activation), а JWT эндпоинты отключены.

**Код:** `backend/apps/api/urls.py`
```python
path('auth/', include('djoser.urls')),  # Только для password reset, activation
# path('auth/', include('djoser.urls.jwt')),  # ОТКЛЮЧЕНО
```

### 2. Почему ротация refresh токенов вручную?

**Причина:** `CookieTokenRefreshView` делает ротацию и blacklist вручную, поэтому встроенная ротация SimpleJWT отключена.

**Настройки:**
```python
'ROTATE_REFRESH_TOKENS': False,      # Ротация вручную
'BLACKLIST_AFTER_ROTATION': False,     # Blacklist вручную
```

**Код:** `backend/apps/users/api/views.py` → `CookieTokenRefreshView.post()`
```python
old.blacklist()  # Вручную добавляем в blacklist
new_refresh = RefreshToken.for_user(user)  # Вручную создаем новый
```

### 3. Почему AuthStatusView требует access токен?

**Проблема:** Если `AuthStatusView` не требует токен, он всегда вернет `false`, даже если есть refresh cookie.

**Решение:** `AuthStatusView` требует `IsAuthenticated` + `JWTAuthentication`, поэтому:
- Если access токен валиден → `{"isAuthenticated": true}`
- Если токена нет или истек → 401 → фронтенд делает refresh

**Код:** `backend/apps/users/api/views.py` → `AuthStatusView`
```python
class AuthStatusView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    
    def get(self, request):
        return Response({'isAuthenticated': True})  # Если дошли сюда - токен валиден
```

### 4. Почему CSRF для refresh/logout, но не для login/register?

**Причина:**
- `login/register` — не используют cookie, поэтому CSRF не нужен
- `refresh/logout` — используют refresh cookie, поэтому CSRF обязателен

**Код:**
```python
@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):  # CSRF отключен
    ...

class CookieTokenRefreshView(APIView):  # CSRF включен (через middleware)
    ...
```

### 5. Почему проверка is_active в LoginView?

**Причина:** Djoser создает пользователей с `is_active=False` до подтверждения email, но `authenticate()` может вернуть такого пользователя (зависит от backend).

**Решение:** Явная проверка `user.is_active` в `LoginView` перед выдачей токенов.

**Код:** `backend/apps/users/api/views.py` → `LoginView.post()`
```python
if not user.is_active:
    return Response(
        {"detail": "Аккаунт не активирован. Пожалуйста, подтвердите email."},
        status=status.HTTP_403_FORBIDDEN
    )
```

**Важно:** OAuth провайдеры (Google/Facebook) создают пользователей с `is_active=True`, поэтому они не попадают в эту проверку.

### 6. Согласованность cookie параметров

**Важно:** Параметры refresh cookie должны совпадать с CSRF cookie:

**Refresh cookie (views.py):**
```python
def _cookie_params():
    secure = not settings.DEBUG
    samesite = getattr(settings, 'CSRF_COOKIE_SAMESITE', ...)
    domain = getattr(settings, 'SESSION_COOKIE_DOMAIN', ...) if not DEBUG else None
```

**CSRF cookie (settings.py):**
```python
CSRF_COOKIE_SECURE = True  # В проде
CSRF_COOKIE_DOMAIN = ".fan-vers.com"  # В проде
CSRF_COOKIE_SAMESITE = 'None'  # Из env с нормализацией
```

### 7. Middleware порядок

**Важно:** `CsrfViewMiddleware` должен быть **ДО** `AuthenticationMiddleware`:

**Код:** `backend/FanVers_project/settings.py` → `MIDDLEWARE`
```python
MIDDLEWARE = [
    ...
    'django.middleware.csrf.CsrfViewMiddleware',  # ДО AuthenticationMiddleware
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    ...
]
```

---

## Резюме

Система авторизации FanVers использует:

1. **JWT токены** — access в заголовке, refresh в HttpOnly cookie
2. **CSRF защита** — для эндпоинтов, использующих refresh cookie (refresh/logout)
3. **Ротация токенов** — вручную в `CookieTokenRefreshView`
4. **Email активация** — через Djoser, проверка `is_active` в `LoginView`
5. **Безопасность** — защита от XSS, CSRF, перехвата токенов
6. **Throttling** — ограничение запросов на эндпоинты авторизации

Все настройки согласованы между cookie параметрами, CSRF настройками и CORS правилами для корректной работы в dev и prod окружениях.
