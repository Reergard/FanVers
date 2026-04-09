import html as html_lib
import os
from django.db import models
from django.db.models import Q
from django.utils.html import strip_tags
from django.utils.text import slugify
from django.urls import reverse
import docx
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.conf import settings
from django.utils import timezone
from unidecode import unidecode
import re
from datetime import timedelta
import logging
from decimal import Decimal

import bleach

logger = logging.getLogger(__name__)


def _chapter_plain_text_len(html_str: str) -> int:
    """Довжина видимого тексту без HTML-тегів (для character_count / reading_time)."""
    if not html_str:
        return 0
    text = strip_tags(html_str)
    text = html_lib.unescape(text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return len(text)


CHAPTER_HTML_ALLOWED_TAGS = frozenset(
    [
        "p",
        "br",
        "b",
        "i",
        "em",
        "strong",
        "ul",
        "ol",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "span",
        "a",
        "table",
        "tr",
        "td",
        "th",
        "thead",
        "tbody",
        "img",
        "blockquote",
        "sup",
        "sub",
    ]
)

CHAPTER_HTML_ALLOWED_ATTRS = {
    "a": ["href", "title"],
    "img": ["src", "alt", "title"],
    "span": ["class"],
    "td": ["colspan", "rowspan"],
    "th": ["colspan", "rowspan"],
    "*": ["class"],
}


def sanitize_chapter_html(html_content: str) -> str:
    if not html_content:
        return ""
    return bleach.clean(
        html_content,
        tags=list(CHAPTER_HTML_ALLOWED_TAGS),
        attributes=CHAPTER_HTML_ALLOWED_ATTRS,
        strip=True,
        protocols=["http", "https", "mailto"],
    )


def create_slug(title):
    return slugify(title)


def book_image_path(instance, filename):
    book_name = slugify(instance.title)
    filename = clean_filename(filename)
    path = os.path.join('books', book_name)
    return os.path.join(path, filename)
    # Отримуємо розширення файлу
    ext = filename.split('.')[-1]
    # Формуємо нове ім'я файлу
    new_filename = f"{instance.slug}.{ext}"
    # Повертаємо шлях для збереження
    return f'books/images/{new_filename}'


def book_directory_path(instance, filename):
    local_cleaned_filename = clean_filename(filename)
    return f'books/{instance.slug}/{local_cleaned_filename}'


def chapter_directory_path(instance, filename):
    local_cleaned_filename = clean_chapter_filename(filename)
    # Створюємо шлях для книги та розділу
    path = os.path.join('books', instance.book.slug, 'chapters')
    return os.path.join(path, local_cleaned_filename)


def clean_filename(filename):
    invalid_chars = {'/', '\\', '?', '%', '*', ':', '|', '"', '<', '>', '.'}
    name, ext = os.path.splitext(filename)
    for c in invalid_chars:
        name = name.replace(c, '')
    return f"{name}{ext}"


def clean_chapter_filename(filename):
    invalid_chars = {'/', '\\', '?', '%', '*', ':', '|', '"', '<', '>'}
    for c in invalid_chars:
        filename = filename.replace(c, '')
    return filename


def validate_image_extension(value):
    valid_extensions = ['.jpg', '.jpeg', '.png']
    ext = os.path.splitext(value.name)[1]
    if ext.lower() not in valid_extensions:
        raise ValidationError('Непідтримуване розширення файлу.')


class Tag(models.Model):
    name = models.CharField(max_length=255)
    group = models.ForeignKey('catalog.TagGroups', on_delete=models.CASCADE, related_name='tags')

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('catalog:tag_detail', args=[str(self.pk)])


class TagGroups(models.Model):
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name


class Fandom(models.Model):
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('catalog:fandom_detail', args=[str(self.pk)])


class Country(models.Model):
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('catalog:country_detail', args=[str(self.pk)])


class Genres(models.Model):
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('catalog:genres_detail', args=[str(self.pk)])


class Book(models.Model):
    BOOK_TYPES = [
        ('AUTHOR', 'Авторська'),
        ('TRANSLATION', 'Переклад'),
    ]
    
    TRANSLATION_STATUSES = [
        ('TRANSLATING', 'Перекладається'),
        ('WAITING', 'В очікуванні розділів'),
        ('PAUSED', 'Перерва'),
        ('ABANDONED', 'Покинутий'),
    ]
    
    ORIGINAL_STATUS_CHOICES = [
        ('ONGOING', 'Виходить'),
        ('STOPPED', 'Припинено'),
        ('COMPLETED', 'Завершений'),
    ]


    id = models.AutoField(primary_key=True)
    
    title = models.CharField(max_length=255)
    title_en = models.CharField(max_length=255, null=True)
    author = models.CharField(max_length=255)
    book_type = models.CharField(
        max_length=20,
        choices=BOOK_TYPES,
        default='TRANSLATION', #  Book.TranslationStatuses.TRANSLATION
        verbose_name='Тип твору'
    )
    creator = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_books'
    )
    owner = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='owned_books'
    )
    tags = models.ManyToManyField(Tag)
    genres = models.ManyToManyField(Genres)
    fandoms = models.ManyToManyField(Fandom)
    country = models.ForeignKey(
        Country, 
        on_delete=models.PROTECT,  
        null=False,
        blank=False,
        verbose_name='Країна'
    )
    slug = models.SlugField(unique=True, blank=True, max_length=255)
    description = models.TextField(blank=True, null=True)
    image = models.ImageField(
        upload_to=book_image_path,
        null=True,
        blank=True,
        verbose_name='Зображення книги'
    )

    last_updated = models.DateTimeField(
        auto_now=True,
        verbose_name='Останнє оновлення'
    )
    # Остання «людська» активність власника перекладу (глава, зміна статусу перекладу).
    # Не оновлювати з довільних save() / аналітики / читачів — див. Book.mark_translation_owner_activity.
    owner_last_activity_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Активність власника (переклад)',
    )
    abandoned_warning_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Попередження про Покинуті надіслано',
    )
    translation_status = models.CharField(
        max_length=20,
        choices=TRANSLATION_STATUSES,
        null=True,
        blank=True,
        verbose_name='Статус перекладу'
    )
    
    original_status = models.CharField(
        max_length=20,
        choices=ORIGINAL_STATUS_CHOICES,
        default='ONGOING',
        verbose_name='Статус випуску оригіналу'
    )

    created_at = models.DateTimeField(
        default=timezone.now,
        verbose_name='Дата створення'
    )
    adult_content = models.BooleanField(default=False, verbose_name='Контент 18+')
    
    # Налаштування доступу до книги
    ACCESS_CHOICES = [
        ('all', 'Усі'),
        ('bookmarked', 'У кого в закладках'),
        ('none', 'Ніхто'),
    ]
    
    # Права доступу
    view_permission = models.CharField(
        max_length=20,
        choices=ACCESS_CHOICES,
        default='all',
        verbose_name='Увійти на сторінку книги'
    )
    comment_book_permission = models.CharField(
        max_length=20,
        choices=ACCESS_CHOICES,
        default='all',
        verbose_name='Коментувати книгу'
    )
    comment_chapter_permission = models.CharField(
        max_length=20,
        choices=ACCESS_CHOICES,
        default='all',
        verbose_name='Коментувати розділ'
    )
    download_permission = models.CharField(
        max_length=20,
        choices=ACCESS_CHOICES,
        default='all',
        verbose_name='Завантажити'
    )
    rate_permission = models.CharField(
        max_length=20,
        choices=ACCESS_CHOICES,
        default='all',
        verbose_name='Оцінити'
    )

    

    def generate_unique_slug(self):
        """Генерує унікальний слаг для книги"""
        # Проверяем наличие title
        if not self.title:
            # Если нет title, создаем временный slug
            return f"book-{timezone.now().timestamp()}"
        
        # Транслітерація та базове очищення
        slug = slugify(unidecode(self.title))
        
        # Если slug пустой после обработки, создаем временный
        if not slug:
            slug = f"book-{timezone.now().timestamp()}"
        
        # Якщо title_en існує, використовуємо його як основу
        if self.title_en:
            title_en_slug = slugify(unidecode(self.title_en))
            if title_en_slug:
                slug = title_en_slug
            
        # Видаляємо всі спеціальні символи крім дефісу
        slug = re.sub(r'[^a-zA-Z0-9-]', '', slug)
        
        # Замінюємо множинні дефіси на один
        slug = re.sub(r'-+', '-', slug)
        
        # Обмежуємо довжину слагу
        max_length = self._meta.get_field('slug').max_length
        if len(slug) > max_length:
            slug = slug[:max_length]
        
        # Перевіряємо унікальність та додаємо числовий суфікс якщо потрібно
        original_slug = slug
        counter = 1
        while Book.objects.filter(slug=slug).exists():
            # Додаємо числовий суфікс
            suffix = f'-{counter}'
            # Обрізаємо оригінальний слаг щоб вмістити суфікс
            slug = f'{original_slug[:max_length - len(suffix)]}{suffix}'
            counter += 1
            
        return slug

    def clean(self):
        """Валідація моделі"""
        from django.core.exceptions import ValidationError
        
        super().clean()
        
        # Валидация обязательных полей (только если объект уже имеет данные)
        # Не валидируем при создании через админку, так как форма сама это делает
        if self.title and not self.title.strip():
            raise ValidationError({'title': "Поле 'title' не может быть пустым"})
        if self.author and not self.author.strip():
            raise ValidationError({'author': "Поле 'author' не может быть пустым"})
        
        # Генерируем slug если его нет и есть title
        if not self.slug and self.title:
            self.slug = self.generate_unique_slug()

    def save(self, *args, **kwargs):
        """Збереження моделі"""
        # Проверяем, создается ли новая книга или редактируется существующая
        is_new_book = self.pk is None
        
        # Валидация обязательных полей (ошибки будут показаны через clean())
        # Не поднимаем исключения здесь, чтобы админка могла показать ошибки формы
        
        if is_new_book:
            # Для новых книг устанавливаем статус по умолчанию
            if self.book_type == 'AUTHOR':
                self.translation_status = None
            elif self.book_type == 'TRANSLATION':
                if not self.translation_status:
                    self.translation_status = 'TRANSLATING'
        else:
            # Для существующих книг проверяем валидность
            if self.book_type == 'AUTHOR' and self.translation_status is not None:
                # Авторские книги не могут иметь статус перевода
                self.translation_status = None
            elif self.book_type == 'TRANSLATION' and self.translation_status is None:
                # Переводы должны иметь статус
                self.translation_status = 'TRANSLATING'
        
        # Генерируем slug только если его нет и есть title
        if not self.slug and self.title:
            self.slug = self.generate_unique_slug()
        elif not self.slug:
            # Если нет title, создаем временный slug
            self.slug = f"book-{timezone.now().timestamp()}"

        # Переклад з власником: завжди мати відлік активності (адмінка, shell, не лише API).
        if self.book_type == 'TRANSLATION' and self.owner_id and self.owner_last_activity_at is None:
            self.owner_last_activity_at = timezone.now()

        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

    @property
    def chapters_count(self):
        chapters = self.chapters.count()
        return chapters

    def has_recent_activity(self):
        """
        Чи була «свіжа» активність за останній місяць.
        Для перекладів з owner_last_activity_at — тільки вона (узгоджено з логікою Покинутих).
        Інакше — загальний евристичний критерій (глави / last_updated).
        """
        month_ago = timezone.now() - timedelta(days=30)
        if self.book_type == 'TRANSLATION' and self.owner_last_activity_at is not None:
            return self.owner_last_activity_at >= month_ago
        return (
            self.chapters.filter(created_at__gte=month_ago).exists()
            or self.last_updated >= month_ago
        )

    @classmethod
    def mark_translation_owner_activity(cls, book):
        """
        Фіксує дію власника перекладу: оновлює owner_last_activity_at і скидає цикл попередження.
        Викликати лише з явних користувацьких дій власника (глава, зміна translation_status).
        """
        if book.book_type != 'TRANSLATION' or not book.owner_id:
            return
        now = timezone.now()
        cls.objects.filter(pk=book.pk).update(
            owner_last_activity_at=now,
            abandoned_warning_sent_at=None,
        )
        book.owner_last_activity_at = now
        book.abandoned_warning_sent_at = None


def process_table(table):
    table_text = ''
    for row in table.rows:
        for cell in row.cells:
            # Process paragraphs inside table cells
            if cell._element.body:
                for element in cell._element.body:
                    if isinstance(element, docx.text.paragraph.Paragraph):
                        table_text += f'<p>{element.text}</p>'
    return table_text


class Volume(models.Model):
    book = models.ForeignKey(Book, related_name="volumes", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.book.title} - {self.title}"

    class Meta:
        ordering = ['order', 'created_at']
        unique_together = ('book', 'title')


class ChapterOrderContainer(models.Model):
    """
    Версія контейнера порядку для optimistic concurrency.
    Контейнер = (book_id, volume_id). volume_id=NULL = "без тому".
    """
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='chapter_order_containers')
    volume = models.ForeignKey(
        Volume, on_delete=models.CASCADE, null=True, blank=True, related_name='chapter_order_containers'
    )
    version = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['book', 'volume'],
                name='uniq_chapter_container',
                condition=Q(volume__isnull=False),
            ),
            models.UniqueConstraint(
                fields=['book'],
                name='uniq_chapter_container_no_vol',
                condition=Q(volume__isnull=True),
            ),
        ]


class Chapter(models.Model):
    title = models.CharField(max_length=255)
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='chapters')
    volume = models.ForeignKey(
        Volume, 
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='chapters'
    )
    slug = models.SlugField(unique=False, blank=True)
    file = models.FileField(upload_to=chapter_directory_path, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)
    is_paid = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=1, db_index=True)
    characters_count = models.IntegerField(default=0, verbose_name='Кількість символів')
    html_content = models.TextField(blank=True, null=True)
    html_file_path = models.CharField(max_length=255, blank=True, null=True)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('1.00'),
        verbose_name='Вартість розділу',
        validators=[
            MinValueValidator(Decimal("0.00")),
            MaxValueValidator(Decimal("1000.00")),
        ],
    )
    reading_time = models.IntegerField(default=0)  # час у секундах
    character_count = models.IntegerField(default=0)
    min_reading_time = models.IntegerField(default=0)  # мінімальний час для зарахування прочитання

    class Meta:
        ordering = ['order']
        constraints = [
            models.UniqueConstraint(
                fields=['book', 'volume', 'order'],
                name='uniq_chapter_order_in_volume',
                condition=Q(volume__isnull=False),
            ),
            models.UniqueConstraint(
                fields=['book', 'order'],
                name='uniq_chapter_order_no_volume',
                condition=Q(volume__isnull=True),
            ),
            models.UniqueConstraint(
                fields=['book', 'slug'],
                name='uniq_chapter_slug_per_book',
            ),
        ]

    def generate_unique_slug(self):
        """Генерує унікальний слаг для розділів"""
        base_slug = slugify(unidecode(self.title))
        
        # Видаляємо спеціальні символи
        slug = re.sub(r'[^a-zA-Z0-9-]', '', base_slug)
        
        # Замінюємо множинні дефіси
        slug = re.sub(r'-+', '-', slug)
        
        # Перевіряємо унікальність
        original_slug = slug
        counter = 1
        while Chapter.objects.filter(
            book=self.book,
            slug=slug
        ).exists():
            suffix = f'-{counter}'
            slug = f'{original_slug}{suffix}'
            counter += 1
            
        return slug

    def save(self, *args, **kwargs):
        # Генерація слагу при першому збереженні
        if not self.slug:
            self.slug = self.generate_unique_slug()    
        
        # Підрахунок символів та часу читання (по тексту читача, не по сирих HTML-тегах)
        if self.html_content:
            plain_len = _chapter_plain_text_len(self.html_content)
            self.character_count = plain_len
            self.characters_count = plain_len
            # 3 хвилини на 1000 символів = 180 секунд на 1000 символів
            self.reading_time = (plain_len / 1000) * 180
            self.min_reading_time = self.reading_time * 0.75
            
        try:
            super().save(*args, **kwargs)
        except Exception as e:
            logger.error(f"Помилка збереження розділу: {str(e)}")
            raise

    def __str__(self):
        return f"{self.book.title} - {self.title}"

    def generate_html_filename(self):
        return f'books/{self.book.slug}/chapters/html/{self.slug}.html'

    def save_html_content(self, html_content):
        """Єдине джерело HTML — поле html_content у БД; диск лише для зворотної сумісності при читанні."""
        try:
            html_content = sanitize_chapter_html(html_content)
            if self.html_file_path:
                legacy_path = os.path.join(settings.MEDIA_ROOT, self.html_file_path)
                if os.path.isfile(legacy_path):
                    try:
                        os.remove(legacy_path)
                    except OSError:
                        logger.warning("Could not remove legacy chapter html file: %s", legacy_path)
            plain_len = _chapter_plain_text_len(html_content)
            self.html_file_path = None
            self.html_content = html_content
            self.character_count = plain_len
            self.characters_count = plain_len
            self.reading_time = (plain_len / 1000) * 180 if plain_len else 0
            self.min_reading_time = self.reading_time * 0.75 if self.reading_time else 0
            self.save(
                update_fields=[
                    "html_file_path",
                    "html_content",
                    "character_count",
                    "characters_count",
                    "reading_time",
                    "min_reading_time",
                ]
            )
        except Exception as e:
            raise

    def get_html_content(self):
        try:
            # Спочатку перевіряємо наявність HTML в базі даних
            if self.html_content:
                return self.html_content
            
            # Потім перевіряємо файл на диску
            if self.html_file_path:
                file_path = os.path.join(settings.MEDIA_ROOT, self.html_file_path)
                
                if os.path.exists(file_path):
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # Кешуємо контент в базі даних
                        self.html_content = content
                        self.save(update_fields=['html_content'])
                        return content
            
            # Якщо HTML не знайдено, пробуємо конвертувати docx
            if self.file:
                # Тут має бути логіка конвертації docx в HTML
                # Наприклад, використання python-docx або іншої бібліотеки
                pass
            
            return None
            
        except Exception:
            return None

    @property
    def user_progress(self):
        """
        Отримати прогрес читання для цього розділу
        """
        from apps.monitoring.models import UserChapterProgress
        return UserChapterProgress.objects.filter(chapter=self)


class ChapterOrder(models.Model):
    """
    DEPRECATED: Порядок глав зберігається в Chapter.order.
    Ця модель не використовується API. Залишена для міграцій.
    """
    volume = models.ForeignKey(Volume, on_delete=models.CASCADE)
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE)
    position = models.DecimalField(max_digits=10, decimal_places=1, default=Decimal('0'))

    class Meta:
        ordering = ['position']
        unique_together = ('volume', 'chapter')







