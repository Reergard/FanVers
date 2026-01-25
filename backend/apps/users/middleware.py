from threading import local
import logging
import time

logger = logging.getLogger(__name__)
_thread_locals = local()

class RequestMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        # Логируем для auth endpoints для диагностики
        if (request.path.startswith('/api/users/login/') or 
            request.path.startswith('/api/users/register/') or
            request.path.startswith('/api/users/refresh/') or
            request.path.startswith('/api/users/logout/')):
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
        
        # Логируем ответ для auth endpoints
        if (request.path.startswith('/api/users/login/') or 
            request.path.startswith('/api/users/register/') or
            request.path.startswith('/api/users/refresh/') or
            request.path.startswith('/api/users/logout/')):
            logger.info(f"🔍 [RequestMiddleware] Response status: {response.status_code}")
            if response.status_code in [403, 401]:
                logger.error(f"🔍 [RequestMiddleware] {response.status_code} response! Check CSRF, permissions, or tokens")
            logger.info(f"🔍 [RequestMiddleware] === END REQUEST ===")
        
        return response

def get_current_request():
    return getattr(_thread_locals, 'request', None) 