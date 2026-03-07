import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FanVers_project.settings')

import django
django.setup()

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from channels.auth import AuthMiddlewareStack
from channels.sessions import SessionMiddlewareStack

# Эти импорты теперь безопасны — Django уже инициализирован
from apps.chat.routing import websocket_urlpatterns

django_asgi_app = get_asgi_application()

# WebSocket: cookie-based auth (session). Токен в URL не передається — OWASP best practice.
# Session встановлюється при login/register; AllowedHostsOriginValidator перевіряє origin.
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        SessionMiddlewareStack(
            AuthMiddlewareStack(
                URLRouter(websocket_urlpatterns)
            )
        )
    ),
})
