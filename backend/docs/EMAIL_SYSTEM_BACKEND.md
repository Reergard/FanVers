# Email-система Backend

## Обзор

Сайт отправляет транзакционные письма (активация email, сброс пароля, уведомления) через **Brevo SMTP**. Входящая почта на `info@fan-vers.com` пересылается в Gmail через **Cloudflare Email Routing**. Домен `fan-vers.com` обслуживается DNS-зоной Cloudflare (перенесён с ukraine.com.ua).

## Архитектура (общая картина)

```
Django (Contabo)  ──SMTP──▶  Brevo (smtp-relay.brevo.com:587)  ──▶  Gmail/Yahoo/Outlook юзеров
                                      │
                                      └── подпись DKIM через fan-vers.com

Входящие письма:
отправитель  ──▶  MX (Cloudflare Email Routing)  ──▶  правило info@fan-vers.com  ──▶  fan.vers.ua@gmail.com
```

## DNS-записи домена fan-vers.com (у Cloudflare)

Все записи DNS-only (серая тучка, без проксирования).

| Тип | Name | Значение | Назначение |
|---|---|---|---|
| TXT | `fan-vers.com` (`@`) | `brevo-code:19731c5870ddeb01a1bf98d8809b5078` | Верификация домена в Brevo |
| CNAME | `brevo1._domainkey` | `b1.fan-vers-com.dkim.brevo.com` | DKIM-ключ Brevo #1 |
| CNAME | `brevo2._domainkey` | `b2.fan-vers-com.dkim.brevo.com` | DKIM-ключ Brevo #2 |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` | DMARC-политика (моніторинг) |
| MX | `fan-vers.com` | `route1.mx.cloudflare.net`, `route2...`, `route3...` | Приём почты (Cloudflare Email Routing) |
| TXT | `fan-vers.com` | `v=spf1 include:_spf.mx.cloudflare.net ~all` | SPF для Cloudflare Email Routing |

DKIM-записи **нельзя** ставить на Proxied — иначе Cloudflare подменит значение и подпись сломается.

## Настройки Django (settings.py)

```python
EMAIL_BACKEND = "apps.users.email_backend.LoggingEmailBackend"
EMAIL_HOST = env("EMAIL_HOST")                    # smtp-relay.brevo.com
EMAIL_PORT = env("EMAIL_PORT")                    # 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = env("EMAIL_HOST_USER")          # логин из Brevo SMTP
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD")  # SMTP-key из Brevo
DEFAULT_FROM_EMAIL = "info@fan-vers.com"
```

`LoggingEmailBackend` (`apps/users/email_backend.py`) — обёртка над стандартным SMTP с детальным логированием каждого письма (from/to/subject/тип/результат).

## Переменные .env (production)

```
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_HOST_USER=a89b56001@smtp-brevo.com
EMAIL_HOST_PASSWORD=<SMTP-key из Brevo → SMTP & API>
```

Для dev можно оставить Mailtrap sandbox (`sandbox.smtp.mailtrap.io:2525`) — тестовые письма не попадают реальным юзерам.

## DJOSER и активация email

В `settings.py`:

```python
DJOSER = {
    'SEND_ACTIVATION_EMAIL': True,
    'ACTIVATION_URL': 'activate/{uid}/{token}',
    ...
}
```

Модель `User.is_active = False` по умолчанию — новые юзеры неактивны до подтверждения email.

### Активация email — реализация

Регистрация идёт через кастомный `RegisterView` (`apps/users/api/views.py`). Djoser-овский
`UserViewSet.perform_create` в этом flow не вызывается, поэтому письмо активации
отправляется **вручную** внутри `RegisterView.post()` сразу после `serializer.save()`:

```python
if not getattr(user, "is_active", True):
    from djoser.email import ActivationEmail
    ActivationEmail(request, {"user": user}).send(to=[user.email])
    return Response(
        {"detail": "Реєстрація успішна. Підтвердіть email для входу."},
        status=status.HTTP_201_CREATED,
    )
```

Шаблон письма — `backend/templates/email/activation.html` (кастомный с брендингом FanVers, ссылки с `https://`).

Эндпоинты djoser на `/api/auth/`:

- `POST /api/auth/users/activation/` — тело `{uid, token}` (фронт: страница `/activate/:uid/:token`).
- `POST /api/auth/users/resend_activation/` — тело `{email}` для повторной отправки.

### Production: переменная `DOMAIN` в `.env`

В `FanVers_project/settings.py` задаётся `DOMAIN = env("DOMAIN")` — djoser подставляет это значение в ссылки писем. На сервере проверьте:

```bash
cd /path/to/backend
grep "^DOMAIN=" .env
grep "^FRONTEND_URL=" .env
```

Ожидаемо для продакшена:

- `DOMAIN=fan-vers.com` (без `http://`, без завершающего `/`)
- `FRONTEND_URL=https://fan-vers.com` (если используется в других местах проекта)

После изменения `.env` перезапустите gunicorn (или ваш процесс приложения).

## OAuth (Google/Facebook)

Социально созданные юзеры активируются в пайплайне `apps/users/social_pipeline.py` (шаг `activate_social_user`). Email у них уже подтверждён провайдером — письмо активации не нужно.

## Sender в Brevo

- **From name:** `FanVers`
- **From email:** `info@fan-vers.com`
- **Status:** Verified (подтверждено через письмо, которое Cloudflare переслал на Gmail)
- **DKIM signature:** `fan-vers.com` ✅
- **DMARC:** configured ✅
- Старый sender `fan.vers.ua@gmail.com` удалён — Gmail с февраля 2024 блокирует freemail-адреса в массовых рассылках.

## Входящая почта (Cloudflare Email Routing)

Настроено правило:
- **Custom address:** `info@fan-vers.com`
- **Action:** Send to an email
- **Destination:** `fan.vers.ua@gmail.com` (verified)

Используется только для приёма служебных писем (подтверждения sender в Brevo, возможные ответы юзеров). Ящики на домене не создавались — пересылка в Gmail достаточна.

## Тест отправки

```bash
cd /Fan-vers.com/app/src/backend
source venv/bin/activate
python manage.py shell
```

```python
from django.core.mail import send_mail
send_mail(
    subject='Тест',
    message='Проверка SMTP',
    from_email=None,  # возьмёт DEFAULT_FROM_EMAIL
    recipient_list=['some@email.com'],
    fail_silently=False,
)
# должно вернуть 1
```

Проверка в Brevo: **Transactional → Email Activity** (`https://app.brevo.com/transactional/email-activity`) — статус `Delivered`.

## Лимиты и тариф

- **Brevo Free:** 300 писем/день. Для транзакционных писем (активация, сброс пароля) достаточно на старте.
- При росте трафика — апгрейд до Brevo Starter ($9/мес, 5k писем) или миграция на Amazon SES ($0.10 за 1k писем).

## Файлы и ответственность

- `apps/users/email_backend.py` — `LoggingEmailBackend` (SMTP + логирование).
- `apps/users/api/views.py` — `RegisterView` (создание юзера; отправка activation email из `RegisterView` для неактивных пользователей).
- `apps/users/api/serializers.py` — `CreateUserSerializer` (создание пользователя; письмо активации **не** из сериализатора).
- `templates/email/*.html` — кастомные шаблоны писем djoser (активация, сброс пароля/логина, подтверждения).
- `apps/users/social_pipeline.py` — `activate_social_user` для OAuth.
- `apps/api/urls.py` — подключение `djoser.urls` на `/api/auth/` (активация, сброс пароля и т.д.).
- `FanVers_project/settings.py` — DJOSER, EMAIL_*, `DOMAIN`, SOCIAL_AUTH_*.

## Безопасность

- SMTP-key отдельный от пароля Brevo-аккаунта, может быть отозван независимо.
- Рекомендуется ограничить SMTP-key по IP сервера (Brevo → SMTP & API → ключ → Edit).
- В Cloudflare включён 2FA (защита DNS-зоны).
- В ukraine.com.ua — только NS-сервера (`fay.ns.cloudflare.com`, `glen.ns.cloudflare.com`), DNS-записи хранятся в Cloudflare.
- DMARC пока `p=none` (мониторинг). Через 1-2 месяца стабильной работы — переключить на `p=quarantine`.
