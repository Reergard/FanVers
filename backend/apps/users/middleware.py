from threading import local
import logging
import time
from django.conf import settings

logger = logging.getLogger(__name__)
_thread_locals = local()

class RequestMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        # Логируем для auth endpoints только в DEBUG (в проде не светим токены/куки/заголовки)
        if settings.DEBUG and (
            request.path.startswith('/api/users/login/') or 
            request.path.startswith('/api/users/register/') or
            request.path.startswith('/api/users/refresh/') or
            request.path.startswith('/api/users/logout/')
        ):
            logger.info(f"🔍 [RequestMiddleware] === START REQUEST ===")
            logger.info(f"🔍 [RequestMiddleware] Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"🔍 [RequestMiddleware] Method: {request.method}")
            logger.info(f"🔍 [RequestMiddleware] Path: {request.path}")
            logger.info(f"🔍 [RequestMiddleware] Headers: X-CSRFToken={request.headers.get('X-CSRFToken', 'NOT SET')[:50] if request.headers.get('X-CSRFToken') else 'NOT SET'}, X-Requested-With={request.headers.get('X-Requested-With', 'NOT SET')}")
            logger.info(f"🔍 [RequestMiddleware] CSRF cookie: {request.COOKIES.get('csrftoken', 'NOT SET')[:50] if request.COOKIES.get('csrftoken') else 'NOT SET'}")
            logger.info(f"🔍 [RequestMiddleware] Refresh cookie: {request.COOKIES.get('refresh_token', 'NOT SET')[:50] if request.COOKIES.get('refresh_token') else 'NOT SET'}")
            logger.info(f"🔍 [RequestMiddleware] Origin: {request.headers.get('Origin', 'NOT SET')}")
            logger.info(f"🔍 [RequestMiddleware] Referer: {request.headers.get('Referer', 'NOT SET')}")
        
        _thread_locals.request = request
        response = self.get_response(request)
        
        # Логируем ответ для auth endpoints только в DEBUG
        if settings.DEBUG and (
            request.path.startswith('/api/users/login/') or 
            request.path.startswith('/api/users/register/') or
            request.path.startswith('/api/users/refresh/') or
            request.path.startswith('/api/users/logout/')
        ):
            logger.info(f"🔍 [RequestMiddleware] Response status: {response.status_code}")
            
            # Для refresh endpoint: 401 логируем как INFO, если нет Authorization заголовка (тихий запрос до логина)
            # Если есть Authorization заголовок, значит пользователь был авторизован - это реальная ошибка
            if response.status_code == 401 and request.path.startswith('/api/users/refresh/'):
                has_auth_header = bool(request.headers.get('Authorization'))
                if has_auth_header:
                    # Пользователь был авторизован, но refresh не удался - это ошибка
                    logger.error(f"🔍 [RequestMiddleware] 401 response! User was authenticated but refresh failed. Check refresh token.")
                else:
                    # Тихий запрос до логина - это нормально, логируем как info
                    logger.info(f"🔍 [RequestMiddleware] 401 response (silent refresh before login) - это нормально для гостей")
            elif response.status_code in [403, 401]:
                # Для других endpoints или 403 - логируем как error
                logger.error(f"🔍 [RequestMiddleware] {response.status_code} response! Check CSRF, permissions, or tokens")
            
            logger.info(f"🔍 [RequestMiddleware] === END REQUEST ===")
        
        return response

def get_current_request():
    return getattr(_thread_locals, 'request', None) 