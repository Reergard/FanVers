# Розгортання на продакшені (Production)

## Перед запуском

### 1. Throttle classes — обов'язково розкоментувати

У проекті є ряд ендпоінтів з закоментованим `throttle_classes` для зручності розробки. **На продакшені їх обов'язково потрібно розкоментувати**, щоб захистити API від зловживань.

**Файл:** `backend/apps/users/api/views.py`

Шукайте рядки з коментарем:
```python
# throttle_classes = [ProfileThrottle]  # Розкоментувати на продакшені
```

**Що зробити:** Розкоментуйте цей рядок і переконайтеся, що клас `ProfileThrottle` визначений (або використовуйте `ScopedRateThrottle` з відповідним `throttle_scope`).

**Ендпоінти, де це потрібно:**
- `RegisterView`
- `ProfileDetailView`
- `update_profile_view`
- `UpdateEmailView`
- `delete_profile_image`
- `get_user_profile` (вже має `@throttle_classes([ScopedRateThrottle])`)
- `become_translator`
- `become_author`
- `AuthStatusView`
- `get_user_statistics`

**Приклад:**
```python
# Було:
# throttle_classes = [ProfileThrottle]  # Розкоментувати на продакшені

# Стало:
throttle_classes = [ScopedRateThrottle]
throttle_scope = 'profile'
```

### 2. Змінні середовища (.env)

Переконайтеся, що встановлено:
- `DEBUG=False`
- `SECRET_KEY` — надійний випадковий ключ
- `ALLOWED_HOSTS` — ваш домен
- `CSRF_TRUSTED_ORIGINS` — https://ваш-домен.com
- `FRONTEND_URL` — URL фронтенду (наприклад https://fan-vers.com)
- Для OAuth: `SOCIAL_AUTH_GOOGLE_OAUTH2_KEY`, `SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET` (якщо використовується)

### 3. WebSocket

WebSocket використовує cookie-based auth (сесія). Переконайтеся, що:
- Nginx проксує `/ws` на backend (Daphne/ASGI)
- Cookie domain налаштований для одного батьківського домену (наприклад `.fan-vers.com`)

### 4. Celery

Celery використовує налаштування з `settings.py` (`CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`). Переконайтеся, що Redis доступний і змінні `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB_CELERY` встановлені коректно.
