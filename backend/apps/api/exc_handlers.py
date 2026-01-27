from rest_framework.views import exception_handler
from rest_framework.exceptions import Throttled, PermissionDenied
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def drf_exception_handler(exc, context):
    """
    Кастомный обработчик исключений для DRF
    Добавляет детальную информацию для 429 ошибок и логирует 403 ошибки
    """
    request = context.get("request")
    view = context.get("view")
    
    # Логируем 403 ошибки для диагностики
    if isinstance(exc, (PermissionDenied, DjangoPermissionDenied)):
        logger.error(f"🚫 [ExceptionHandler] === 403 Permission Denied ===")
        logger.error(f"🚫 [ExceptionHandler] Path: {request.path if request else 'N/A'}")
        logger.error(f"🚫 [ExceptionHandler] Method: {request.method if request else 'N/A'}")
        logger.error(f"🚫 [ExceptionHandler] View: {view.__class__.__name__ if view else 'N/A'}")
        logger.error(f"🚫 [ExceptionHandler] User: {request.user if request and hasattr(request, 'user') else 'N/A'}")
        if settings.DEBUG:
            logger.error(f"🚫 [ExceptionHandler] Headers: {dict(request.headers) if request else 'N/A'}")
        logger.error(f"🚫 [ExceptionHandler] Exception type: {type(exc).__name__}")
        logger.error(f"🚫 [ExceptionHandler] Exception message: {str(exc)}")
    
    response = exception_handler(exc, context)
    
    if isinstance(exc, Throttled) and response is not None:
        scope = getattr(view, "throttle_scope", None)
        
        # Детальная информация для фронтенда
        response.data = {
            "detail": response.data.get("detail", "Request was throttled."),
            "scope": scope,
            "available_in_sec": exc.wait,   # секунды до повтора
            "error_type": "throttled"
        }
        
        # Добавляем заголовки для фронтенда
        if exc.wait:
            response["X-RateLimit-Reset"] = str(exc.wait)
            response["Retry-After"] = str(exc.wait)
        
        logger.warning(f"Request throttled: scope={scope}, wait={exc.wait}s, view={view.__class__.__name__}")
    
    return response
