from django.core.cache import cache
from rest_framework.throttling import BaseThrottle
import logging

logger = logging.getLogger(__name__)

class SmartThrottle:
    """
    Утилита для определения подозрительных запросов
    Используется как дополнительный флаг, не заменяет DRF throttling
    """
    
    # Константы для атомарного счетчика
    THRESHOLD = 120  # за 60 сек
    TTL = 60
    PREFIX = "st:req:"
    
    @staticmethod
    def _client_ident(request):
        """
        Определяет идентификатор клиента используя ту же логику, что и DRF
        Учитывает X-Forwarded-For и NUM_PROXIES
        """
        return BaseThrottle().get_ident(request)
    
    @staticmethod
    def is_suspicious_request(request):
        """
        Определяет, является ли запрос подозрительным
        Использует атомарный счетчик и правильную идентификацию клиента
        """
        try:
            # Проверяем User-Agent (дополнительный сигнал, не основной блокер)
            user_agent = (request.META.get('HTTP_USER_AGENT') or '').lower()
            suspicious_agents = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget']
            
            if any(x in user_agent for x in suspicious_agents):
                return True
                
            # Получаем идентификатор клиента (учитывает прокси)
            ident = SmartThrottle._client_ident(request)
            key = f"{SmartThrottle.PREFIX}{ident}"
            
            # Атомарная инициализация и увеличение
            added = cache.add(key, 1, SmartThrottle.TTL)  # если ключа нет — создаст (1) на 60 сек
            if not added:
                try:
                    count = cache.incr(key)
                except ValueError:
                    # ключ успел умереть между add и incr — пересоздаём
                    cache.add(key, 1, SmartThrottle.TTL)
                    count = 1
            else:
                count = 1
            
            return count >= SmartThrottle.THRESHOLD
                
        except Exception as e:
            logger.error(f"Error in is_suspicious_request: {e}")
            # В случае ошибки - считаем запрос не подозрительным
            return False
