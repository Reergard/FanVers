from pathlib import Path
import os
from datetime import timedelta
from decimal import Decimal
from urllib.parse import quote
import environ
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        # Убираем файловое логирование для продакшена
        # logging.FileHandler('debug.log', encoding='utf-8')
    ]
)

env = environ.Env(
    DEBUG=(bool, False)
)

BASE_DIR = Path(__file__).resolve().parent.parent

environ.Env.read_env(BASE_DIR / ".env")  # Читаємо .env файл

SECRET_KEY = env("SECRET_KEY")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env('DEBUG')

# У проді JWT signing key має бути окремим секретом у .env (не fallback на SECRET_KEY).
if DEBUG:
    SIGNING_KEY = env("SIGNING_KEY", default=SECRET_KEY)
else:
    SIGNING_KEY = env("SIGNING_KEY")

# Нестандартний шлях адмінки (Nginx whitelist окремо). Див. DJANGO_ADMIN_PATH у .env
DJANGO_ADMIN_PATH = (os.getenv("DJANGO_ADMIN_PATH", "admin") or "admin").strip().strip("/") or "admin"

# Окремий ключ для symmetric encryption у channels_redis (не ділити з JWT/session).
_WS_KEY_RAW = (env("WS_ENCRYPTION_KEY", default="") or "").strip()
CHANNEL_SYMMETRIC_ENCRYPTION_KEYS = [_WS_KEY_RAW] if _WS_KEY_RAW else [SECRET_KEY]

# Hosts
if DEBUG:
    ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['127.0.0.1', 'localhost'])
else:
    ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['fan-vers.com', 'www.fan-vers.com'])

INSTALLED_APPS = [
    'unfold',
    'unfold.contrib.filters',
    'unfold.contrib.forms',
    'unfold.contrib.inlines',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sitemaps',

    # Custom apps
    'apps.api',
    'apps.main',
    'apps.catalog',
    'apps.users',
    'apps.search',
    'apps.reviews',
    'apps.navigation',
    'apps.chat',
    'apps.editors',
    'apps.website_advertising',
    'apps.notification.apps.NotificationConfig',
    'apps.monitoring.apps.MonitoringConfig',
    'apps.analytics_books.apps.AnalyticsBooksConfig',
    'apps.subscription.apps.SubscriptionConfig',
    'apps.support.apps.SupportConfig',
    'apps.payments.apps.PaymentsConfig',
    'apps.payouts.apps.PayoutsConfig',
    'apps.seo.apps.SeoConfig',

    'rest_framework',
    'rest_framework.authtoken',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'djoser',
    'apps.rating.apps.RatingConfig',
    'channels',
    'django_celery_beat',
    'social_django',
    'csp',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'apps.seo.middleware.SeoPrerendererMiddleware',
    'csp.middleware.CSPMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',  # Нужен для CSRF (если CSRF_USE_SESSIONS=True)
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',  # КРИТИЧНО: должен быть ДО AuthenticationMiddleware
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.users.middleware.RequestMiddleware',  
]



# CORS настройки для продакшена
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = False  # Используем белый список даже в DEBUG для дисциплины
    CORS_ALLOWED_ORIGINS = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        "http://10.0.2.2:5173",
        "http://10.0.2.2:5174",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        # Локальна мережа — для тестування з телефону (замініть на свій IP при потребі)
        "http://192.168.1.105:5173",
        "http://192.168.1.105:5174",
    ]
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = [
        "https://fan-vers.com",
        "https://www.fan-vers.com",
    ]

CORS_ALLOW_CREDENTIALS = True

# WebSocket CORS настройки
CORS_ALLOW_WEBSOCKET = True
if DEBUG:
    CORS_ALLOW_WEBSOCKET_ORIGINS = [
        "ws://127.0.0.1:3000",
        "ws://localhost:3000",
        "ws://127.0.0.1:5173",
        "ws://localhost:5173",
        "ws://127.0.0.1:5174",
        "ws://localhost:5174",
        "ws://192.168.1.105:5173",
        "ws://192.168.1.105:5174",
    ]
else:
    CORS_ALLOW_WEBSOCKET_ORIGINS = [
        "wss://fan-vers.com",
        "wss://www.fan-vers.com",
    ]

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-request-id",  # Додаємо заголовок для відстеження запитів
    "cache-control"  # Додаємо для no-cache
]

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]

CORS_PREFLIGHT_MAX_AGE = 86400  # 24 часа
CORS_EXPOSE_HEADERS = [
    "Content-Type", "X-CSRFToken",
    "Retry-After", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"
]


ROOT_URLCONF = 'FanVers_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / os.path.join('templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'FanVers_project.wsgi.application'

DEFAULT_AUTH_CLASSES = [
    'rest_framework_simplejwt.authentication.JWTAuthentication',
]
if DEBUG:
    DEFAULT_AUTH_CLASSES.append('rest_framework.authentication.SessionAuthentication')

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': DEFAULT_AUTH_CLASSES,
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'NUM_PROXIES': 1,  # Количество прокси перед Django (Nginx/Load-balancer)
    'EXCEPTION_HANDLER': 'apps.api.exc_handlers.drf_exception_handler',
    'DEFAULT_THROTTLE_RATES': {
        # базовые коридоры (сетка безопасности >= максимального скопа)
        'user': '240/min',      # авторизованные (>= read_heavy)
        'anon': '120/min',      # анонимы (>= read_light)
        # скопы (бизнес-логика)
        'read_heavy': '240/min',   # чтение «тяжёлых» страниц (детали книги, ленты)
        'read_light': '120/min',   # общий листинг/поиск
        'rating': '30/min',        # голоса/лайки/дизлайки
        'analytics': '60/min',     # trackView и прочее телеметрия
        'upload': '20/hour',       # загрузки
        'purchase': '10/hour',     # покупки
        'balance': '100/hour',     # баланс (как у вас)
        'payout': '5/hour',        # запити на виплату
        'profile': '60/min',       # профили (разумный лимит)
        'profile_write': '10/min',
        'password_change': '5/min',
        'role_promotion': '3/min',
        'auth_status': '120/min',
        'monitoring': '10/min',    # мониторинг статистики
        'thanks': '5/min',         # благодарности авторам
        'chat_create': '10/min',   # створення чату (анти-спам)
        'chat_user_search': '30/min',  # підказки ніків (анти-enumeration)
        # Auth endpoints
        'auth_login': '5/min',     # логин
        'auth_refresh': '30/min',  # обновление токенов
        'auth_logout': '20/min',   # логаут
        'support_ticket': '10/hour',  # звернення в підтримку (на IP / user id)
        'editor_chapter_image': '120/hour',  # зображення в редакторі (прив'язка до глави)
        'book_extra_image': '30/hour',  # додаткові зображення книги (upload/replace)
        'payout_submit': '5/hour',   # подача заявки на виплату (дебет балансу)
        'payout_method': '10/hour',  # додавання методів виплати
        'payout_cancel': '10/hour',  # скасування запитів на виплату
        'payout_profile': '10/hour',  # створення/редагування/видалення профілю виплат
    }
}

DJOSER = {
    'LOGIN_FIELD': 'username', # для входу  використовувати логін
    'USER_CREATE_PASSWORD_RETYPE': True,
    'USERNAME_CHANGED_EMAIL_CONFIRMATION': True,
    'PASSWORD_CHANGED_EMAIL_CONFIRMATION': True,
    'SEND_CONFIRMATION_EMAIL': True,
    'PASSWORD_RESET_CONFIRM_URL': "password/reset/confirm/{uid}/{token}",
    'SET_PASSWORD_RETYPE': True,
    'PASSWORD_RESET_CONFIRM_RETYPE': True,
    'USERNAME_RESET_CONFIRM_URL': 'username/reset/confirm/{uid}/{token}',
    'ACTIVATION_URL': 'activate/{uid}/{token}',
    'SEND_ACTIVATION_EMAIL': True,
    'SERIALIZERS': {
        'user_create': 'apps.users.api.serializers.CreateUserSerializer',
        'user': 'apps.users.api.serializers.CreateUserSerializer',
        'user_delete': 'djoser.serializers.UserDeleteSerializer',
        'current_user': 'apps.users.api.serializers.CurrentUserSerializer',
    }
}


IS_PRODUCTION_ENV = env.bool("IS_PRODUCTION_ENV")

# Используем кастомный email backend с логированием
EMAIL_BACKEND = "apps.users.email_backend.LoggingEmailBackend"
EMAIL_HOST = env("EMAIL_HOST")
EMAIL_USE_TLS = True
EMAIL_PORT = env("EMAIL_PORT")
EMAIL_HOST_USER = env("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = "info@fan-vers.com"
DOMAIN = env("DOMAIN")
SITE_NAME = "FanVers"


# Налаштування SimpleJWT
SIMPLE_JWT = {
    'AUTH_HEADER_TYPES': ('Bearer',),  # Тільки Bearer для безпеки
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),  # 15 хвилин
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),  # 7 днів
    'ROTATE_REFRESH_TOKENS': False,  # Ротация делается вручную в CookieTokenRefreshView
    'BLACKLIST_AFTER_ROTATION': False,  # Blacklist делается вручную в CookieTokenRefreshView
    'UPDATE_LAST_LOGIN': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SIGNING_KEY,
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': None,
    'JWK_URL': None,
    'LEEWAY': 120,  # 2 хвилини буфера для стабільності
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'USER_AUTHENTICATION_RULE': 'rest_framework_simplejwt.authentication.default_user_authentication_rule',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'TOKEN_USER_CLASS': 'rest_framework_simplejwt.models.TokenUser',
    'JTI_CLAIM': 'jti',
    'SLIDING_TOKEN_REFRESH_EXP_CLAIM': 'refresh_exp',
    'SLIDING_TOKEN_LIFETIME': timedelta(minutes=5),
    'SLIDING_TOKEN_REFRESH_LIFETIME': timedelta(days=1),
}







# Настройки Redis для разных сервисов (разделение DB)
REDIS_HOST = os.getenv('REDIS_HOST', '127.0.0.1')
REDIS_PORT = os.getenv('REDIS_PORT', '6379')
REDIS_PASSWORD = (os.getenv('REDIS_PASSWORD', '') or '').strip()
REDIS_PORT_INT = int(str(REDIS_PORT).strip() or '6379')

# Разные DB для разных сервисов
REDIS_DB_CACHE = int(os.getenv('REDIS_DB_CACHE', '1'))      # Django Cache (throttling/SmartThrottle)
REDIS_DB_CELERY = int(os.getenv('REDIS_DB_CELERY', '2'))    # Celery broker/result
REDIS_DB_CHANNELS = int(os.getenv('REDIS_DB_CHANNELS', '3')) # Channels WebSocket


def _redis_url(db_index: int) -> str:
    if REDIS_PASSWORD:
        return f'redis://:{quote(REDIS_PASSWORD, safe="")}@{REDIS_HOST}:{REDIS_PORT_INT}/{db_index}'
    return f'redis://{REDIS_HOST}:{REDIS_PORT_INT}/{db_index}'


def _channel_redis_hosts():
    if REDIS_PASSWORD:
        return [_redis_url(REDIS_DB_CHANNELS)]
    return [(REDIS_HOST, REDIS_PORT_INT)]

# Обратная совместимость
REDIS_DB = os.getenv('REDIS_DB', '0')

# Затем настройки Celery
CELERY_BROKER_URL = _redis_url(REDIS_DB_CELERY)
CELERY_RESULT_BACKEND = _redis_url(REDIS_DB_CELERY)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
# Покинуті переклади: dev — щохвилини; прод — раз на добу (див. FanVers_project/celery.py).
# env.bool() коректно читає .env на Windows (без «1\\r» у os.environ).
ABANDONED_BEAT_EVERY_MINUTE = env.bool('ABANDONED_BEAT_EVERY_MINUTE', default=False)
ABANDONED_THRESHOLDS_USE_MINUTES = env.bool('ABANDONED_THRESHOLDS_USE_MINUTES', default=False)
# Періодичні задачі Celery Beat — у FanVers_project/celery.py (beat_schedule).
# django_celery_beat залишено в INSTALLED_APPS для існуючих міграцій / адмінки.










USE_POSTGRES = env.bool('USE_POSTGRES')

CONN_MAX_AGE = int(os.getenv('CONN_MAX_AGE', '60'))

if USE_POSTGRES:
    DATABASES = {
        'default': {
            # 'ENGINE': 'django.contrib.gis.db.backends.postgis',
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': env.str('DB_NAME'),
            'USER': env.str('DB_USER'),
            'PASSWORD': env.str('DB_PASS'),
            'HOST': env.str('DB_HOST'),
            'PORT': env.int('DB_PORT'),
            'CONN_MAX_AGE': CONN_MAX_AGE,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
            'CONN_MAX_AGE': CONN_MAX_AGE,
        }
    }



AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]




ASGI_APPLICATION = 'FanVers_project.asgi.application'

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": _channel_redis_hosts(),
            "prefix": f"fanvers_channels_{REDIS_DB_CHANNELS}",
            "symmetric_encryption_keys": CHANNEL_SYMMETRIC_ENCRYPTION_KEYS,
            "capacity": 1500,
            # Убираем таймер который закрывает WebSocket!
            # "expiry": 10,
            "group_expiry": 86400,
            "channel_capacity": {
                "http.request": 100,
                "http.response!*": 100,
                "websocket.send!*": 100,
            },
        },
    },
}


LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Налаштування для статичних файлів
STATIC_URL = '/static/'

STATIC_ROOT = os.getenv(
    "DJANGO_STATIC_ROOT",
    os.path.join(BASE_DIR, "staticfiles")
)

# Налаштування безпеки для завантаження файлів
SECURE_CONTENT_TYPE_NOSNIFF = True
# Загальний ліміт тіла запиту (кілька файлів / обкладинка + поля); окремі серіалізатори додатково обмежують розмір файлів.
_FILE_UPLOAD_MAX = int(os.getenv("DATA_UPLOAD_MAX_MB", "18")) * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = _FILE_UPLOAD_MAX
DATA_UPLOAD_MAX_MEMORY_SIZE = _FILE_UPLOAD_MAX
FILE_UPLOAD_TEMP_DIR = None  # Використовуємо тимчасову папку системи

# Додаткові налаштування безпеки
X_FRAME_OPTIONS = 'DENY'

# Настройки CSRF cookie
# Важно: эти настройки должны быть согласованы с refresh cookie
CSRF_COOKIE_HTTPONLY = False  # JavaScript должен иметь доступ для чтения (через get_token())
CSRF_USE_SESSIONS = False  # Используем cookies, не сессии (по умолчанию)

# HSTS та інші заголовки безпеки (тільки на проде)
if not DEBUG:
    SECURE_SSL_REDIRECT = True            # Тільки на проде
    SESSION_COOKIE_SECURE = True          # Якщо використовуєте сесії
    CSRF_COOKIE_SECURE = True             # CSRF cookie только через HTTPS
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
    
    # Cookie домены для работы на www и apex доменах
    SESSION_COOKIE_DOMAIN = ".fan-vers.com"  # Работает для fan-vers.com и www.fan-vers.com
    CSRF_COOKIE_DOMAIN = ".fan-vers.com"    # Работает для fan-vers.com и www.fan-vers.com
    
    # SameSite: за замовчуванням Lax; None лише якщо явно потрібен cross-site (і Secure=True).
    # Нормализуем значение из env: none/NONE/None -> 'None', остальное -> 'Lax'
    raw = os.getenv('CSRF_COOKIE_SAMESITE', 'Lax')
    raw = (raw or '').strip().lower()
    CSRF_COOKIE_SAMESITE = 'None' if raw == 'none' else 'Lax'
    
    # HSTS (HTTP Strict Transport Security) - тільки на проде
    SECURE_HSTS_SECONDS = 31536000  # 1 рік
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
else:
    # Dev налаштування - ВРЕМЕННО ОТКЛЮЧАЕМ ВСЕ HTTPS
    SECURE_SSL_REDIRECT = False
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False  # В dev разрешаем HTTP
    CSRF_COOKIE_SAMESITE = 'Lax'  # В dev можно Lax

# Настройки для работы за прокси (Nginx) - КРИТИЧНО для HTTPS редиректов

# Налаштування для медіа файлів
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

# Дозволи для файлів
FILE_UPLOAD_PERMISSIONS = 0o644
FILE_UPLOAD_DIRECTORY_PERMISSIONS = 0o755

# Дозволені типи зображень
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']


DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'users.User'

# OAuth (Google, Facebook) — credentials з .env
AUTHENTICATION_BACKENDS = (
    'social_core.backends.google.GoogleOAuth2',
    'social_core.backends.facebook.FacebookOAuth2',
    'django.contrib.auth.backends.ModelBackend',
)
SOCIAL_AUTH_GOOGLE_OAUTH2_KEY = env('SOCIAL_AUTH_GOOGLE_OAUTH2_KEY', default='')
SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET = env('SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET', default='')
SOCIAL_AUTH_GOOGLE_OAUTH2_SCOPE = ['email', 'profile']
SOCIAL_AUTH_FACEBOOK_KEY = env('SOCIAL_AUTH_FACEBOOK_KEY', default='')
SOCIAL_AUTH_FACEBOOK_SECRET = env('SOCIAL_AUTH_FACEBOOK_SECRET', default='')
SOCIAL_AUTH_FACEBOOK_SCOPE = ['email', 'public_profile']
SOCIAL_AUTH_FACEBOOK_API_VERSION = 'v18.0'
SOCIAL_AUTH_PIPELINE = (
    'social_core.pipeline.social_auth.social_details',
    'social_core.pipeline.social_auth.social_uid',
    'social_core.pipeline.social_auth.auth_allowed',
    'social_core.pipeline.social_auth.social_user',
    'social_core.pipeline.user.get_username',
    'social_core.pipeline.user.create_user',
    'apps.users.social_pipeline.activate_social_user',
    'social_core.pipeline.social_auth.associate_user',
    'social_core.pipeline.social_auth.load_extra_data',
    'social_core.pipeline.user.user_details',
)
FRONTEND_URL = env('FRONTEND_URL', default=('http://127.0.0.1:5173' if DEBUG else 'https://fan-vers.com'))
SEO_SITE_URL = (env('SEO_SITE_URL', default=FRONTEND_URL) or FRONTEND_URL).rstrip('/')
SEO_PRERENDER_ENABLED = env.bool('SEO_PRERENDER_ENABLED', default=True)
LOGIN_REDIRECT_URL = '/api/users/oauth-complete/'
LOGIN_ERROR_URL = '/api/users/oauth-error/'

# Настройки логирования для Celery
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose'
        },
        # Убираем файловое логирование для продакшена
        # 'file': {
        #     'class': 'logging.FileHandler',
        #     'filename': 'debug.log',
        #     'formatter': 'verbose'
        # },
        'celery_file': {
            'class': 'logging.FileHandler',
            'filename': 'celery.log',
            'formatter': 'verbose'
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],  # Убираем 'file'
            'level': 'INFO',
            'propagate': True,
        },
        'apps.users': {
            'handlers': ['console'],  # Убираем 'file'
            'level': 'ERROR',
            'propagate': True,
        },
        'celery': {
            'handlers': ['console', 'celery_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'channels': {
            'handlers': ['console'],  # Убираем 'file'
            'level': 'DEBUG',
            'propagate': True,
        },
        'apps.chat': {
            'handlers': ['console'],  # Убираем 'file'
            'level': 'DEBUG',
            'propagate': True,
        },
    },
}

# Максимальная сумма операции с балансом
MAX_BALANCE_OPERATION_AMOUNT = 100000  # макс поповнення за раз

# === Payouts ===
PAYOUTS_MIN_AMOUNT_COINS = Decimal("1000.00")
PAYOUTS_MAX_AMOUNT_COINS = Decimal("50000.00")
PAYOUT_DEADLINE_DAYS = 14
PAYOUT_URGENT_DEADLINE_DAYS = 3
PAYOUT_URGENT_COMMISSION_PERCENT = Decimal("10.00")
WISE_SOURCE_CURRENCY = "CZK"
WISE_API_TOKEN = env.str("WISE_API_TOKEN", default="")
WISE_WEBHOOK_ENABLED = env.bool("WISE_WEBHOOK_ENABLED", default=False)
PAYOUT_ADMIN_EMAIL = env.str("PAYOUT_ADMIN_EMAIL", default="")
PAYOUT_ENCRYPTION_KEY = env.str("PAYOUT_ENCRYPTION_KEY", default="")
PAYOUT_ENCRYPTION_KEY_OLD = env.str("PAYOUT_ENCRYPTION_KEY_OLD", default="")

if not DEBUG and not PAYOUT_ENCRYPTION_KEY:
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured("PAYOUT_ENCRYPTION_KEY must be set in production")

# --- Stripe (Checkout Session) ---
STRIPE_SECRET_KEY = env.str("STRIPE_SECRET_KEY", default="")
STRIPE_WEBHOOK_SECRET = env.str("STRIPE_WEBHOOK_SECRET", default="")
STRIPE_API_VERSION = env.str("STRIPE_API_VERSION", default="2024-12-18.acacia")
STRIPE_SUCCESS_URL = env.str(
    "STRIPE_SUCCESS_URL",
    default=("http://127.0.0.1:5173/payment/success" if DEBUG else "https://fan-vers.com/payment/success"),
)
STRIPE_CANCEL_URL = env.str(
    "STRIPE_CANCEL_URL",
    default=("http://127.0.0.1:5173/profile" if DEBUG else "https://fan-vers.com/profile"),
)

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': _redis_url(REDIS_DB_CACHE),
        'KEY_PREFIX': 'fanvers_cache',
        'TIMEOUT': 300,  # 5 минут по умолчанию
    }
}

# Content-Security-Policy (спочатку Report-Only; див. CSP_ENABLED у .env)
from csp.constants import NONE, SELF, UNSAFE_INLINE

CONTENT_SECURITY_POLICY = None
if env.bool('CSP_ENABLED', default=True):
    CONTENT_SECURITY_POLICY_REPORT_ONLY = {
        'EXCLUDE_URL_PREFIXES': (f'/{DJANGO_ADMIN_PATH}/',),
        'DIRECTIVES': {
            'default-src': [SELF],
            'script-src': [SELF],
            'style-src': [SELF, UNSAFE_INLINE],
            'img-src': [SELF, 'data:'],
            'connect-src': [SELF],
            'frame-ancestors': [NONE],
        },
    }
else:
    CONTENT_SECURITY_POLICY_REPORT_ONLY = None

# CSRF_TRUSTED_ORIGINS - домены, которым Django доверяет для CSRF
# Должны включать все домены, с которых могут приходить запросы
if DEBUG:
    # Dev: базовый список + всегда добавляем ключевые origins (на случай переопределения в .env)
    _csrf_dev_base = [
        'http://127.0.0.1:5173', 'http://localhost:5173',
        'http://127.0.0.1:8000', 'http://localhost:8000',
        'http://192.168.1.105:5173', 'http://192.168.1.105:5174',
        'http://10.0.2.2:5173', 'http://10.0.2.2:5174',  # Android emulator
    ]
    _csrf_from_env = env.list('CSRF_TRUSTED_ORIGINS', default=[])
    CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(_csrf_from_env + _csrf_dev_base))
else:
    # Prod настройки
    CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=[
        'https://fan-vers.com',
        'https://www.fan-vers.com',
    ])

# --- Optional: merge dev CORS from .env (дополняем, не заменяем полностью) ---
CORS_DEV_ORIGINS = env.list('CORS_DEV_ORIGINS', default=[])
if DEBUG and CORS_DEV_ORIGINS:
    CORS_ALLOWED_ORIGINS = list(dict.fromkeys(CORS_DEV_ORIGINS + CORS_ALLOWED_ORIGINS))

# --- Proxy headers (work behind Nginx) ---
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    USE_X_FORWARDED_HOST = True
else:
    SECURE_PROXY_SSL_HEADER = None

from urllib.parse import urlencode

from django.urls import reverse, reverse_lazy
from django.utils.translation import gettext_lazy as _


def _payout_requests_link(query: dict):
    """Посилання на changelist заявок з фільтром по status (для SIDEBAR unfold)."""

    def link(request):
        base = reverse("admin:payouts_payoutrequest_changelist")
        return f"{base}?{urlencode(query, doseq=True)}"

    return link

UNFOLD = {
    "SITE_TITLE": "FanVers Admin",
    "SITE_HEADER": "FanVers",
    "SITE_SUBHEADER": "Панель управління",
    "SITE_SYMBOL": "auto_stories",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": True,
    "THEME": None,
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": False,
        "navigation": [
            {
                "title": _("Контент"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {"title": _("Книги"), "icon": "menu_book", "link": reverse_lazy("admin:catalog_book_changelist")},
                    {"title": _("Заявки на переклад"), "icon": "assignment_ind", "link": reverse_lazy("admin:catalog_booktranslatorreview_changelist")},
                    {"title": _("Глави"), "icon": "article", "link": reverse_lazy("admin:catalog_chapter_changelist")},
                    {"title": _("Томи"), "icon": "library_books", "link": reverse_lazy("admin:catalog_volume_changelist")},
                    {"title": _("Жанри"), "icon": "category", "link": reverse_lazy("admin:catalog_genres_changelist")},
                    {"title": _("Теги"), "icon": "label", "link": reverse_lazy("admin:catalog_tag_changelist")},
                    {"title": _("Групи тегів"), "icon": "label_important", "link": reverse_lazy("admin:catalog_taggroups_changelist")},
                    {"title": _("Фандоми"), "icon": "groups_3", "link": reverse_lazy("admin:catalog_fandom_changelist")},
                    {"title": _("Країни"), "icon": "public", "link": reverse_lazy("admin:catalog_country_changelist")},
                    {"title": _("Рейтинги"), "icon": "star", "link": reverse_lazy("admin:rating_bookrating_changelist")},
                    {"title": _("Реклама"), "icon": "campaign", "link": reverse_lazy("admin:website_advertising_advertisement_changelist")},
                ],
            },
            {
                "title": _("Користувачі"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {"title": _("Користувачі"), "icon": "person", "link": reverse_lazy("admin:users_user_changelist")},
                    {"title": _("Профілі"), "icon": "badge", "link": reverse_lazy("admin:users_profile_changelist")},
                    {"title": _("Групи"), "icon": "groups", "link": reverse_lazy("admin:auth_group_changelist")},
                ],
            },
            {
                "title": _("Поповнення балансу"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {"title": _("Платежі (Stripe)"), "icon": "payment", "link": reverse_lazy("admin:payments_paymentsession_changelist")},
                    {"title": _("Stripe-події"), "icon": "webhook", "link": reverse_lazy("admin:payments_webhookevent_changelist")},
                ],
            },
            {
                "title": _("Вивід балансу"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("Нові заявки на виплату"),
                        "icon": "fiber_new",
                        "link": reverse_lazy("admin:payouts_newpayoutrequest_changelist"),
                    },
                    {
                        "title": _("Схвалені заявки"),
                        "icon": "check_circle",
                        "link": _payout_requests_link({"status__exact": "approved"}),
                    },
                    {
                        "title": _("У batch"),
                        "icon": "inventory_2",
                        "link": _payout_requests_link({"status__exact": "in_batch"}),
                    },
                    {
                        "title": _("Відправлені у Wise"),
                        "icon": "send",
                        "link": _payout_requests_link({"status__exact": "processing"}),
                    },
                    {
                        "title": _("Завершені"),
                        "icon": "task_alt",
                        "link": _payout_requests_link({"status__exact": "completed"}),
                    },
                    {
                        "title": _("Скасовані"),
                        "icon": "cancel",
                        "link": _payout_requests_link({"status__exact": "cancelled"}),
                    },
                    {
                        "title": _("Відхилені Wise"),
                        "icon": "error",
                        "link": _payout_requests_link({"status__exact": "failed"}),
                    },
                    {
                        "title": _("Пакети batch для Wise (CSV)"),
                        "icon": "account_balance",
                        "link": reverse_lazy("admin:payouts_payoutbatch_changelist"),
                    },
                    {
                        "title": _("Усі заявки на виплату"),
                        "icon": "request_quote",
                        "link": reverse_lazy("admin:payouts_payoutrequest_changelist"),
                    },
                ],
            },
            {
                "title": _("Підтримка"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {"title": _("Тікети"), "icon": "support_agent", "link": reverse_lazy("admin:support_supportticket_changelist")},
                ],
            },
            {
                "title": _("Моніторинг"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {"title": _("Транзакції"), "icon": "receipt_long", "link": reverse_lazy("admin:monitoring_transactionlog_changelist")},
                    {"title": _("Операції з балансом"), "icon": "account_balance_wallet", "link": reverse_lazy("admin:monitoring_balanceoperationlog_changelist")},
                    {"title": _("Прогрес читання"), "icon": "auto_stories", "link": reverse_lazy("admin:monitoring_userchapterprogress_changelist")},
                    {"title": _("Рекламні логи"), "icon": "ad_group", "link": reverse_lazy("admin:monitoring_advertisinglog_changelist")},
                ],
            },
            {
                "title": _("Підписки"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {"title": _("Налаштування підписок"), "icon": "settings", "link": reverse_lazy("admin:subscription_booksubscriptionsettings_changelist")},
                    {"title": _("Підписки користувачів"), "icon": "card_membership", "link": reverse_lazy("admin:subscription_userbooksubscription_changelist")},
                    {"title": _("Операції підписок"), "icon": "sync", "link": reverse_lazy("admin:subscription_subscriptionoperation_changelist")},
                ],
            },
            {
                "title": _("Повідомлення"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {"title": _("Чати"), "icon": "chat", "link": reverse_lazy("admin:chat_chat_changelist")},
                    {"title": _("Повідомлення"), "icon": "message", "link": reverse_lazy("admin:chat_message_changelist")},
                ],
            },
            {
                "title": _("Система"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {"title": _("Періодичні завдання"), "icon": "schedule", "link": reverse_lazy("admin:django_celery_beat_periodictask_changelist")},
                ],
            },
        ],
    },
}
