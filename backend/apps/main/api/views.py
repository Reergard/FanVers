from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from apps.catalog.models import Book, Chapter
from .serializers import HomeBookCardSerializer
from django.utils import timezone
from django.db.models import Count, Max, OuterRef, Subquery
from datetime import timedelta
import logging
import mammoth
import os
from django.conf import settings

logger = logging.getLogger(__name__)

# «Новинки» на головній — стільки ж записів, скільки в books_news (виключаємо їх з «Останні оновлення»).
_HOME_NEWS_BOOKS_LIMIT = 10
# Вікно нових глав + верхня межа відповіді API (захист від великого JSON і N+1 у серіалізаторі).
_HOME_RECENT_CHAPTER_WINDOW_DAYS = 30
_HOME_RECENT_UPDATES_LIMIT = 60


def _home_page_new_book_ids():
    """Ті самі книги, що в каруселі «Новинки» (узгоджено з books_news: -created_at, -id)."""
    return list(
        Book.objects.order_by("-created_at", "-id").values_list("id", flat=True)[
            :_HOME_NEWS_BOOKS_LIMIT
        ]
    )


def index(request):
    return render(request, "main/index.html")


def home_data(request):
    data = {
        "title": "Ласкаво просимо до UAtranslate",
        "description": "Місце де ви знайдете фанфік або новелу на свій смак. ",
    }
    return JsonResponse(data)

@api_view(['GET'])
@permission_classes([AllowAny])
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
        latest_title_global = (
            Chapter.objects.filter(book_id=OuterRef("pk"))
            .order_by("-created_at", "-id")
            .values("title")[:1]
        )
        new_books = list(
            Book.objects.all()
            .annotate(
                home_chapters_total=Count("chapters", distinct=True),
                latest_chapter_title=Subquery(latest_title_global),
            )
            .order_by("-created_at", "-id")
            .prefetch_related("genres", "tags", "fandoms")[:_HOME_NEWS_BOOKS_LIMIT]
        )

        logger.info("Знайдено нових книг: %s", len(new_books))

        for book in new_books:
            logger.info(
                "Новинка id=%s title=%s глав=%s",
                book.id,
                book.title,
                getattr(book, "home_chapters_total", "?"),
            )

        serializer = HomeBookCardSerializer(new_books, many=True, context={"request": request})
        logger.info(f"Дані після серіалізації: {len(serializer.data)} книг")
        
        return Response(serializer.data)
        
    except Exception as e:
        logger.error(f"Помилка при отриманні нових книг: {str(e)}", exc_info=True)
        return Response({"error": "Помилка при завантаженні нових книг"}, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
def books_recent_updates(request):
    """
    API для блоку «Останні оновлення» (HomePage3).

    Логіка:
    - Потрапляють книги, у яких за останні _HOME_RECENT_CHAPTER_WINDOW_DAYS днів
      з’явилась хоча б одна **нова** глава (поле Chapter.created_at).
    - Кожна книга в списку **один раз**, порядок — за часом **останньої створеної**
      глави в межах цього вікна (найсвіжіша книга перша).
    - Книги з каруселі «Новинки» (ті самі 10, що books_news за created_at твору)
      **виключаються**, щоб не дублювати блок на головній.
    - Не більше _HOME_RECENT_UPDATES_LIMIT книг у відповіді (після сортування за свіжістю).
    - Серіалізатор не робить окремих запитів на count/останню главу — поля з annotate/Subquery.
    """
    logger.info("=== Початок виконання функції books_recent_updates ===")

    try:
        window_start = timezone.now() - timedelta(days=_HOME_RECENT_CHAPTER_WINDOW_DAYS)
        exclude_new_ids = _home_page_new_book_ids()

        # GROUP BY book_id по главах у вікні → одна строка на книгу, Max = час останньої нової глави.
        rows = list(
            Chapter.objects.filter(created_at__gte=window_start)
            .exclude(book_id__in=exclude_new_ids)
            .values("book_id")
            .annotate(last_new_chapter_at=Max("created_at"))
            .order_by("-last_new_chapter_at", "book_id")[:_HOME_RECENT_UPDATES_LIMIT]
        )

        if not rows:
            logger.info("Немає книг з новими главами у вікні або всі вони в «Новинках»")
            return Response([])

        book_ids = [r["book_id"] for r in rows]

        latest_title_in_window = (
            Chapter.objects.filter(
                book_id=OuterRef("pk"),
                created_at__gte=window_start,
            )
            .order_by("-created_at", "-id")
            .values("title")[:1]
        )

        books_qs = (
            Book.objects.filter(pk__in=book_ids)
            .annotate(
                home_chapters_total=Count("chapters", distinct=True),
                latest_chapter_title=Subquery(latest_title_in_window),
            )
            .prefetch_related("genres", "tags", "fandoms")
        )
        books_by_id = {b.pk: b for b in books_qs}
        books_ordered = [books_by_id[i] for i in book_ids if i in books_by_id]
        row_by_book_id = {r["book_id"]: r for r in rows}

        logger.info(
            "Останні оновлення: книг=%s (max %s), виключено новинок=%s",
            len(books_ordered),
            _HOME_RECENT_UPDATES_LIMIT,
            exclude_new_ids,
        )
        for i, book in enumerate(books_ordered, 1):
            row = row_by_book_id.get(book.id)
            if row:
                logger.info(
                    "Позиція %s: id=%s title=%s last_new_chapter_in_window=%s",
                    i,
                    book.id,
                    book.title,
                    row["last_new_chapter_at"],
                )

        serializer = HomeBookCardSerializer(
            books_ordered, many=True, context={"request": request}
        )
        logger.info("Дані після серіалізації: %s книг", len(serializer.data))
        return Response(serializer.data)

    except Exception as e:
        logger.error(f"Помилка при отриманні книг з недавними оновленнями: {str(e)}", exc_info=True)
        return Response(
            {"error": "Помилка при завантаженні останніх оновлень"},
            status=500,
        )


@api_view(['GET'])
@permission_classes([AllowAny])
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
@permission_classes([AllowAny])
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
@permission_classes([AllowAny])
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
@permission_classes([AllowAny])
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
@permission_classes([AllowAny])
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
@permission_classes([AllowAny])
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


