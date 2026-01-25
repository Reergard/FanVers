from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from apps.catalog.models import Book, Chapter
from .serializers import BooksNewsSerializer
from django.utils import timezone
from django.db.models import Max, Q
from datetime import timedelta
import logging
import mammoth
import os
from django.conf import settings

logger = logging.getLogger(__name__)

def index(request):
    return render(request, "main/index.html")


def home_data(request):
    data = {
        "title": "Ласкаво просимо до UAtranslate",
        "description": "Місце де ви знайдете фанфік або новелу на свій смак. ",
    }
    return JsonResponse(data)

@api_view(['GET'])
def books_news(request):
    """
    API для получения новых книг (для HomePage2.js).
    
    Логика:
    1. Все книги, отсортированные по дате создания (новые сверху)
    2. Ограничение: 10 записей
    3. Показывает последние созданные книги
    """
    logger.info("=== Початок виконання функції books_news (новые книги) ===")
    
    try:
        # Получаем все книги, отсортированные по дате создания
        new_books = Book.objects.all().order_by('-created_at')[:10]
        
        logger.info(f"Знайдено нових книг: {new_books.count()}")
        
        # Логируем детали для отладки
        for book in new_books:
            logger.info(f"""
                Книга ID: {book.id}
                Назва: {book.title}
                Створена: {book.created_at}
                Кількість глав: {book.chapters.count()}
            """)
            
        serializer = BooksNewsSerializer(new_books, many=True, context={'request': request})
        logger.info(f"Дані після серіалізації: {len(serializer.data)} книг")
        
        return Response(serializer.data)
        
    except Exception as e:
        logger.error(f"Помилка при отриманні нових книг: {str(e)}", exc_info=True)
        return Response({"error": "Помилка при завантаженні нових книг"}, status=500)


@api_view(['GET'])
def books_recent_updates(request):
    """
    API для получения книг с недавними обновлениями глав (для HomePage3.js).
    
    Логика:
    1. Книги созданы больше суток назад
    2. Имеют главы с недавними обновлениями
    3. Сортировка по времени последнего обновления главы
    4. Ограничение: 10 записей
    """
    logger.info("=== Початок виконання функції books_recent_updates ===")
    
    try:
        # Время сутки назад
        one_day_ago = timezone.now() - timedelta(days=1)
        
        # ВРЕМЕННО: для тестирования убираем ограничение по времени создания книги
        # Получаем книги с недавними обновлениями глав
        # Сначала получаем ID книг с недавними обновлениями
        recent_book_ids = Book.objects.filter(
            # ВРЕМЕННО ЗАКОММЕНТИРОВАНО: Книга создана больше суток назад
            # created_at__lt=one_day_ago,
            # Имеет главы с недавними обновлениями
            chapters__created_at__gte=one_day_ago
        ).values_list('id', flat=True).distinct()
        
        logger.info(f"Знайдено ID книг з недавними оновленнями: {list(recent_book_ids)}")
        
        # Теперь получаем книги с аннотациями по этим ID
        books_with_recent_chapters = Book.objects.filter(
            id__in=recent_book_ids
        ).prefetch_related(
            'genres', 'tags', 'fandoms'
        ).annotate(
            # Время последнего обновления главы (самое свежее)
            last_chapter_update=Max('chapters__created_at')
        ).order_by(
            # Сортировка по времени последнего обновления главы (новые сверху)
            '-last_chapter_update'
        )[:10]  # Ограничиваем до 10 записей
        
        logger.info(f"Знайдено унікальних книг з недавними оновленнями: {books_with_recent_chapters.count()}")
        
        # Логируем детали для отладки
        for i, book in enumerate(books_with_recent_chapters, 1):
            logger.info(f"""
                Позиція {i}:
                Книга ID: {book.id}
                Назва: {book.title}
                Створена: {book.created_at}
                Останнє оновлення глави: {book.last_chapter_update}
                Кількість глав: {book.chapters.count()}
            """)
            
        serializer = BooksNewsSerializer(books_with_recent_chapters, many=True, context={'request': request})
        logger.info(f"Дані після серіалізації: {len(serializer.data)} книг")
        
        return Response(serializer.data)
        
    except Exception as e:
        logger.error(f"Помилка при отриманні книг з недавними оновленнями: {str(e)}", exc_info=True)
        return Response({"error": "Помилка при завантаженні рекомендованих книг"}, status=500)


@api_view(['GET'])
def get_author_agreement(request):
    """
    API для получения содержимого авторского договора из DOCX файла.
    """
    logger.info("=== Початок виконання функції get_author_agreement ===")
    
    try:
        # Путь к DOCX файлу
        docx_path = os.path.join(
            settings.BASE_DIR, 
            '..', 
            'frontend', 
            'src', 
            'info', 
            'legal', 
            'Договір з автором.docx'
        )
        
        logger.info(f"Шлях до файлу: {docx_path}")
        logger.info(f"Файл існує: {os.path.exists(docx_path)}")
        
        if not os.path.exists(docx_path):
            logger.error("Файл авторского договора не найден")
            return Response(
                {"error": "Файл авторского договора не найден"}, 
                status=404
            )
        
        # Конвертируем DOCX в HTML
        with open(docx_path, "rb") as docx_file:
            result = mammoth.convert_to_html(docx_file)
            html_content = result.value
            
            logger.info(f"Конвертація успішна! Довжина HTML: {len(html_content)}")
            
            if result.messages:
                logger.warning(f"Попередження mammoth: {result.messages}")
            
            return Response({
                "title": "Публічний договір з автором",
                "content": html_content
            })
            
    except Exception as e:
        logger.error(f"Помилка при отриманні авторского договора: {str(e)}", exc_info=True)
        return Response(
            {"error": "Помилка при завантаженні авторского договора"}, 
            status=500
        )


@api_view(['GET'])
def get_privacy_policy(request):
    """
    API для получения политики конфиденциальности из DOCX файла.
    """
    logger.info("=== Початок виконання функції get_privacy_policy ===")
    
    try:
        # Путь к DOCX файлу
        docx_path = os.path.join(
            settings.BASE_DIR, 
            '..', 
            'frontend', 
            'src', 
            'info', 
            'legal', 
            'ПОЛІТИКА КОНФІДЕНЦІЙНОСТІ ТА ЗАХИСТУ ПЕРСОНАЛЬНИХ.docx'
        )
        
        logger.info(f"Шлях до файлу: {docx_path}")
        logger.info(f"Файл існує: {os.path.exists(docx_path)}")
        
        if not os.path.exists(docx_path):
            logger.error("Файл политики конфиденциальности не найден")
            return Response(
                {"error": "Файл политики конфиденциальности не найден"}, 
                status=404
            )
        
        # Конвертируем DOCX в HTML
        with open(docx_path, "rb") as docx_file:
            result = mammoth.convert_to_html(docx_file)
            html_content = result.value
            
            logger.info(f"Конвертація успішна! Довжина HTML: {len(html_content)}")
            
            if result.messages:
                logger.warning(f"Попередження mammoth: {result.messages}")
            
            return Response({
                "title": "Політика компанії щодо обробки персональних даних",
                "content": html_content
            })
            
    except Exception as e:
        logger.error(f"Помилка при отриманні политики конфиденциальности: {str(e)}", exc_info=True)
        return Response(
            {"error": "Помилка при завантаженні политики конфиденциальности"}, 
            status=500
        )


@api_view(['GET'])
def get_content_rules(request):
    """
    API для получения правил размещения контента из DOCX файла.
    """
    logger.info("=== Початок виконання функції get_content_rules ===")
    
    try:
        # Путь к DOCX файлу
        docx_path = os.path.join(
            settings.BASE_DIR, 
            '..', 
            'frontend', 
            'src', 
            'info', 
            'legal', 
            'Правила розміщення авторського контенту.docx'
        )
        
        logger.info(f"Шлях до файлу: {docx_path}")
        logger.info(f"Файл існує: {os.path.exists(docx_path)}")
        
        if not os.path.exists(docx_path):
            logger.error("Файл правил размещения контента не найден")
            return Response(
                {"error": "Файл правил размещения контента не найден"}, 
                status=404
            )
        
        # Конвертируем DOCX в HTML
        with open(docx_path, "rb") as docx_file:
            result = mammoth.convert_to_html(docx_file)
            html_content = result.value
            
            logger.info(f"Конвертація успішна! Довжина HTML: {len(html_content)}")
            
            if result.messages:
                logger.warning(f"Попередження mammoth: {result.messages}")
            
            return Response({
                "title": "Правила розміщення авторського контенту",
                "content": html_content
            })
            
    except Exception as e:
        logger.error(f"Помилка при отриманні правил размещения контента: {str(e)}", exc_info=True)
        return Response(
            {"error": "Помилка при завантаженні правил размещения контента"}, 
            status=500
        )


@api_view(['GET'])
def get_translator_agreement(request):
    """
    API для получения договора автор-переводчик из DOCX файла.
    """
    logger.info("=== Початок виконання функції get_translator_agreement ===")
    
    try:
        # Путь к DOCX файлу
        docx_path = os.path.join(
            settings.BASE_DIR, 
            '..', 
            'frontend', 
            'src', 
            'info', 
            'legal', 
            'Договір Автор-Перекладач.doc'
        )
        
        logger.info(f"Шлях до файлу: {docx_path}")
        logger.info(f"Файл існує: {os.path.exists(docx_path)}")
        
        if not os.path.exists(docx_path):
            logger.error("Файл договора автор-переводчик не найден")
            return Response(
                {"error": "Файл договора автор-переводчик не найден"}, 
                status=404
            )
        
        # Конвертируем DOCX в HTML
        with open(docx_path, "rb") as docx_file:
            result = mammoth.convert_to_html(docx_file)
            html_content = result.value
            
            logger.info(f"Конвертація успішна! Довжина HTML: {len(html_content)}")
            
            if result.messages:
                logger.warning(f"Попередження mammoth: {result.messages}")
            
            return Response({
                "title": "Договір між автором та перекладачем",
                "content": html_content
            })
            
    except Exception as e:
        logger.error(f"Помилка при отриманні договора автор-переводчик: {str(e)}", exc_info=True)
        return Response(
            {"error": "Помилка при завантаженні договора автор-переводчик"}, 
            status=500
        )


@api_view(['GET'])
def get_user_agreement(request):
    """
    API для получения угоды пользователя из DOCX файла.
    """
    logger.info("=== Початок виконання функції get_user_agreement ===")
    
    try:
        # Путь к DOCX файлу
        docx_path = os.path.join(
            settings.BASE_DIR, 
            '..', 
            'frontend', 
            'src', 
            'info', 
            'legal', 
            'Угода користувача.docx'
        )
        
        logger.info(f"Шлях до файлу: {docx_path}")
        logger.info(f"Файл існує: {os.path.exists(docx_path)}")
        
        if not os.path.exists(docx_path):
            logger.error("Файл угоды пользователя не найден")
            return Response(
                {"error": "Файл угоды пользователя не найден"}, 
                status=404
            )
        
        # Конвертируем DOCX в HTML
        with open(docx_path, "rb") as docx_file:
            result = mammoth.convert_to_html(docx_file)
            html_content = result.value
            
            logger.info(f"Конвертація успішна! Довжина HTML: {len(html_content)}")
            
            if result.messages:
                logger.warning(f"Попередження mammoth: {result.messages}")
            
            return Response({
                "title": "Угода користувача",
                "content": html_content
            })
            
    except Exception as e:
        logger.error(f"Помилка при отриманні угоды пользователя: {str(e)}", exc_info=True)
        return Response(
            {"error": "Помилка при завантаженні угоды пользователя"}, 
            status=500
        )


@api_view(['GET'])
def get_copyright_holders(request):
    """
    API для получения информации для правовладельцев из DOCX файла.
    """
    logger.info("=== Початок виконання функції get_copyright_holders ===")
    
    try:
        # Путь к DOCX файлу
        docx_path = os.path.join(
            settings.BASE_DIR, 
            '..', 
            'frontend', 
            'src', 
            'info', 
            'legal', 
            'Для правовласників.docx'
        )
        
        logger.info(f"Шлях до файлу: {docx_path}")
        logger.info(f"Файл існує: {os.path.exists(docx_path)}")
        
        if not os.path.exists(docx_path):
            logger.error("Файл для правовладельцев не найден")
            return Response(
                {"error": "Файл для правовладельцев не найден"}, 
                status=404
            )
        
        # Конвертируем DOCX в HTML
        with open(docx_path, "rb") as docx_file:
            result = mammoth.convert_to_html(docx_file)
            html_content = result.value
            
            logger.info(f"Конвертація успішна! Довжина HTML: {len(html_content)}")
            
            if result.messages:
                logger.warning(f"Попередження mammoth: {result.messages}")
            
            return Response({
                "title": "Для правовласників",
                "content": html_content
            })
            
    except Exception as e:
        logger.error(f"Помилка при отриманні информации для правовладельцев: {str(e)}", exc_info=True)
        return Response(
            {"error": "Помилка при завантаженні информации для правовладельцев"}, 
            status=500
        )


