from pathlib import Path
import os
from datetime import timedelta
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
SIGNING_KEY = env("SIGNING_KEY", default=SECRET_KEY)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env('DEBUG')

# Якщо False — POST become-translator / become-author повертають 403 (роль лише через адмінку).
ALLOW_USER_ROLE_SELF_PROMOTION = env.bool("ALLOW_USER_ROLE_SELF_PROMOTION", default=False)

# Hosts
if DEBUG:
    ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['127.0.0.1', 'localhost'])
else:
    ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['fan-vers.com', 'www.fan-vers.com'])

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

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
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
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
        'rest_framework.permissions.AllowAny', 
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
        'profile': '60/min',       # профили (разумный лимит)
        'monitoring': '10/min',    # мониторинг статистики
        'thanks': '5/min',         # благодарности авторам
        # Auth endpoints
        'auth_login': '5/min',     # логин
        'auth_refresh': '30/min',  # обновление токенов
        'auth_logout': '20/min',   # логаут
        'support_ticket': '10/hour',  # звернення в підтримку (на IP / user id)
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

# Разные DB для разных сервисов
REDIS_DB_CACHE = int(os.getenv('REDIS_DB_CACHE', '1'))      # Django Cache (throttling/SmartThrottle)
REDIS_DB_CELERY = int(os.getenv('REDIS_DB_CELERY', '2'))    # Celery broker/result
REDIS_DB_CHANNELS = int(os.getenv('REDIS_DB_CHANNELS', '3')) # Channels WebSocket

# Обратная совместимость
REDIS_DB = os.getenv('REDIS_DB', '0')

# Затем настройки Celery
CELERY_BROKER_URL = f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB_CELERY}'
CELERY_RESULT_BACKEND = f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB_CELERY}'
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
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
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
            "hosts": [('127.0.0.1', 6379)],
            "prefix": f"fanvers_channels_{REDIS_DB_CHANNELS}",
            "symmetric_encryption_keys": [SECRET_KEY],
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
# Підтримка: до 3 вкладень по 5 МБ + поля форми — ліміт тіла запиту вищий за один файл.
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
    
    # SameSite для кросс-сайт запросов (если открываете из Telegram/Instagram/WebView)
    # Используйте "None" если нужен кросс-сайт доступ, "Lax" если только same-site
    # Нормализуем значение из env: none/NONE/None -> 'None', остальное -> 'Lax'
    raw = os.getenv('CSRF_COOKIE_SAMESITE', 'None')
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
MAX_BALANCE_OPERATION_AMOUNT = 100000

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB_CACHE}',
        'KEY_PREFIX': 'fanvers_cache',
        'TIMEOUT': 300,  # 5 минут по умолчанию
    }
}

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
