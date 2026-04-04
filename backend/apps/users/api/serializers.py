import os
import io
from PIL import Image, ImageOps
from django.core.files.base import ContentFile
from django.db import transaction
from rest_framework import serializers
from djoser.serializers import UserCreateSerializer
from django.contrib.auth import get_user_model
from apps.users.models import Profile, BalanceLog
from apps.users.balance_access import (
    API_WITHDRAW_ROLE_FORBIDDEN_MESSAGE,
    profile_can_request_balance_withdraw,
)
from apps.users.role_self_promotion import is_role_self_promotion_allowed
from apps.catalog.models import Chapter, Book
from django.db import models
import logging
from django.conf import settings
from decimal import Decimal
from django.contrib.auth.password_validation import validate_password
import uuid
import time
from django.utils import timezone

logger = logging.getLogger(__name__)

# Захист від декомпресійних бомб в Pillow
Image.MAX_IMAGE_PIXELS = 50_000_000  # Максимум 50MP для безпеки

# Получаем модель User через get_user_model()
User = get_user_model()


class CreateUserSerializer(UserCreateSerializer):
    re_password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 're_password')
        extra_kwargs = {'password': {'write_only': True}}

    def validate(self, attrs):
        if attrs.get('password') != attrs.get('re_password'):
            raise serializers.ValidationError({'re_password': 'Паролі не співпадають'})
        attrs.pop('re_password', None)
        return attrs
    
    def save(self, **kwargs):
        logger.info(f"📧 [CreateUserSerializer] === START USER CREATION ===")
        logger.info(f"📧 [CreateUserSerializer] Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"📧 [CreateUserSerializer] Username: {self.validated_data.get('username', 'N/A')}")
        logger.info(f"📧 [CreateUserSerializer] Email: {self.validated_data.get('email', 'N/A')}")
        
        try:
            logger.info(f"📧 [CreateUserSerializer] Шаг 1: Вызываем родительский save() (Djoser отправит activation email)...")
            user = super().save(**kwargs)
            logger.info(f"📧 [CreateUserSerializer] Шаг 1: Пользователь создан: {user.username} (ID: {user.id})")
            logger.info(f"📧 [CreateUserSerializer] Шаг 1: Email пользователя: {user.email}")
            logger.info(f"📧 [CreateUserSerializer] Шаг 1: is_active: {user.is_active}")
            
            # Djoser автоматически отправляет activation email если SEND_ACTIVATION_EMAIL=True
            # Логирование отправки будет в email backend
            logger.info(f"📧 [CreateUserSerializer] Шаг 2: Djoser должен отправить activation email (если SEND_ACTIVATION_EMAIL=True)")
            logger.info(f"📧 [CreateUserSerializer] === USER CREATION COMPLETE ===")
            
            return user
        except Exception as e:
            logger.error(f"📧 [CreateUserSerializer] Ошибка при создании пользователя: {str(e)}", exc_info=True)
            raise


class CurrentUserSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'balance', 'image')
    
    def get_username(self, obj):
        return obj.profile.username

    def get_balance(self, obj):
        return obj.profile.balance

    def get_image(self, obj):
        request = self.context.get('request')
        url = obj.profile.get_profile_image('small')
        return request.build_absolute_uri(url) if request else url


class BalanceLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = BalanceLog
        fields = ['amount', 'operation_type', 'created_at', 'status']


class ProfileImageUploadSerializer(serializers.Serializer):
    """Сериализатор для загрузки изображения профиля с максимальной безопасностью"""
    image = serializers.ImageField(required=True)
    
    def validate_image(self, value):
        # 1. Жесткая проверка размера файла (максимум 5MB)
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Розмір файлу не може перевищувати 5MB")
        
        # 2. Жесткая проверка формата файла
        allowed_formats = ['image/jpeg', 'image/png', 'image/webp']
        if value.content_type not in allowed_formats:
            raise serializers.ValidationError("Підтримуються тільки формати: JPEG, PNG, WebP")
        
        # 3. Проверяем magic bytes для дополнительной безопасности
        try:
            # Читаем первые 12 байт для проверки сигнатур
            value.seek(0)
            header = value.read(12)
            value.seek(0)
            
            # Проверяем сигнатуры файлов
            is_valid = False
            
            # JPEG: FF D8 FF
            if header[:3] == b'\xff\xd8\xff':
                is_valid = True
            # PNG: 89 50 4E 47
            elif header[:4] == b'\x89PNG':
                is_valid = True
            # WebP: RIFF....WEBP
            elif header[:4] == b'RIFF' and header[8:12] == b'WEBP':
                is_valid = True
            
            if not is_valid:
                raise serializers.ValidationError("Невірний формат файлу або файл пошкоджений")
                
        except Exception as e:
            logger.error(f"Ошибка при проверке magic bytes: {str(e)}")
            raise serializers.ValidationError("Помилка при перевірці файлу")
        
        # 4. Обрабатываем изображение через Pillow для максимальной безопасности
        try:
            # Открываем изображение
            img = Image.open(value)
            
            # Проверяем целостность
            img.verify()
            
            # Повторно открываем для обработки
            value.seek(0)
            img = Image.open(value)
            
            # Убираем EXIF данные и метаданные
            img = ImageOps.exif_transpose(img)
            
            # Ограничиваем максимальный размер (4096x4096)
            if img.width > 4096 or img.height > 4096:
                img.thumbnail((4096, 4096), Image.Resampling.LANCZOS)
            
            # Конвертируем в RGB если нужно
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')
            
            # Сохраняем в безопасном формате (WebP для лучшего сжатия и безопасности)
            # Создаем буфер для сохранения
            buffer = io.BytesIO()
            
            # Сохраняем в WebP с максимальным качеством и безопасностью
            img.save(buffer, format='WEBP', method=6, quality=85, lossless=False)
            
            buffer.seek(0)
            
            # Проверяем размер после обработки
            processed_size = len(buffer.getvalue())
            if processed_size > 5 * 1024 * 1024:
                raise serializers.ValidationError("Файл після обробки все ще завеликий")
            
            # Создаем новое поле файла с безопасным путем
            filename = f"profile_{uuid.uuid4()}.webp"
            processed_file = ContentFile(buffer.getvalue(), name=filename)
            
            return processed_file
            
        except Image.DecompressionBombError:
            logger.error(f"Обнаружена декомпресійна бомба в файлі: {value.name}")
            raise serializers.ValidationError("Файл занадто великий або пошкоджений (декомпресійна бомба)")
        except Exception as e:
            logger.error(f"Ошибка при обработке изображения: {str(e)}")
            raise serializers.ValidationError("Помилка при обробці зображення")
    
    def save(self, **kwargs):
        user = self.context['request'].user
        profile = user.profile
        
        # Atomic-збереження: спочатку зберігаємо нове, потім видаляємо старе
        with transaction.atomic():
            # Зберігаємо ім'я старого файлу
            old_name = profile.image.name if profile.image else None
            
            # Сохраняем новое изображение
            profile.image = self.validated_data['image']
            profile.save(update_fields=['image'])
            
            # Тепер удаляем старое изображение через storage з поля моделі
            if old_name:
                try:
                    # Беремо storage з поля моделі для надійності
                    field_storage = Profile._meta.get_field('image').storage
                    if field_storage.exists(old_name):
                        field_storage.delete(old_name)
                        logger.info(f"Старое изображение профиля удалено через storage: {old_name}")
                except Exception as e:
                    logger.warning(f"Не удалось удалить старое изображение через storage: {e}")
            
            logger.info(f"Новое изображение профиля сохранено для пользователя {user.id}")
        
        return profile


class EmailUpdateSerializer(serializers.Serializer):
    """Сериализатор для обновления email"""
    new_email = serializers.EmailField(required=True)
    
    def validate_new_email(self, value):
        user = self.context['request'].user
        # 1) уникальность среди пользователей
        if User.objects.filter(email=value).exclude(id=user.id).exists():
            raise serializers.ValidationError("Цей email вже використовується іншим користувачем")
        # 2) уникальность среди профилей
        if Profile.objects.filter(email=value).exclude(user_id=user.id).exists():
            raise serializers.ValidationError("Цей email вже використовується іншим користувачем (профіль)")
        return value


class PasswordChangeSerializer(serializers.Serializer):
    """Сериализатор для смены пароля"""
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)
    confirm_password = serializers.CharField(required=True)
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Невірний поточний пароль")
        return value
    
    def validate_new_password(self, value):
        # Валидация нового пароля
        validate_password(value, self.context['request'].user)
        return value
    
    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError("Новий пароль та підтвердження не співпадають")
        return data


class NotificationSettingsSerializer(serializers.ModelSerializer):
    """Сериализатор для настроек сповіщений"""
    class Meta:
        model = Profile
        fields = [
            'notifications_enabled',
            'hide_adult_content', 
            'private_messages_enabled',
            'age_confirmed',
            'comment_notifications',
            'translation_status_notifications',
            'chapter_subscription_notifications',
            'chapter_comment_notifications'
        ]

    def validate(self, attrs):
        # Synchronize 18+ preferences:
        # - hide_adult_content=True  -> age_confirmed=False
        # - age_confirmed=True       -> hide_adult_content=False
        # - age_confirmed=False      -> hide_adult_content=True
        # - hide_adult_content=False (without explicit age flag) -> age_confirmed=True
        hide = attrs.get('hide_adult_content')
        age = attrs.get('age_confirmed')

        if hide is True:
            attrs['age_confirmed'] = False
            return attrs

        if age is True:
            attrs['hide_adult_content'] = False
            return attrs

        if age is False:
            attrs['hide_adult_content'] = True
            return attrs

        if hide is False and 'age_confirmed' not in attrs:
            attrs['age_confirmed'] = True

        return attrs


class CookieConsentSerializer(serializers.Serializer):
    """
    Payload for cookie consent. necessary is always true.
    We store `updated_at` server-side.
    """
    necessary = serializers.BooleanField(required=True)
    preferences = serializers.BooleanField(required=True)
    analytics = serializers.BooleanField(required=True)

    def validate_necessary(self, value):
        if value is not True:
            raise serializers.ValidationError("necessary must be true")
        return value

    def to_storage_value(self):
        data = {
            "necessary": True,
            "preferences": bool(self.validated_data.get("preferences")),
            "analytics": bool(self.validated_data.get("analytics")),
            "updated_at": timezone.now().isoformat(),
        }
        return data


class ProfileSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    can_withdraw_balance = serializers.SerializerMethodField()
    role_self_promotion_allowed = serializers.SerializerMethodField()
    total_characters = serializers.SerializerMethodField()
    total_chapters = serializers.SerializerMethodField()
    free_chapters = serializers.SerializerMethodField()
    total_author = serializers.SerializerMethodField()
    total_translations = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    balance_history = serializers.SerializerMethodField()
    commission = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    read_chapters = serializers.SerializerMethodField()
    purchased_chapters = serializers.SerializerMethodField()
    completed_books = serializers.SerializerMethodField()
    profile_image_small = serializers.SerializerMethodField()
    profile_image_large = serializers.SerializerMethodField()
    has_custom_image = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ['id', 'username', 'about', 'image', 'role', 'can_withdraw_balance',
                 'role_self_promotion_allowed',
                 'total_characters', 'total_chapters', 'free_chapters', 
                 'total_author', 'total_translations', 'is_owner', 'balance_history', 'commission',
                 'read_chapters', 'purchased_chapters', 'completed_books',
                 'profile_image_small', 'profile_image_large', 'has_custom_image',
                 'notifications_enabled', 'hide_adult_content', 'private_messages_enabled', 'age_confirmed',
                 'comment_notifications', 'translation_status_notifications', 
                 'chapter_subscription_notifications', 'chapter_comment_notifications']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        is_owner = request and request.user == self.instance.user

        # Добавляем чувствительные поля только для владельца
        if is_owner:
            self.fields['email'] = serializers.EmailField(source='user.email')
            self.fields['balance'] = serializers.DecimalField(
                max_digits=10,
                decimal_places=2,
                read_only=True,
            )
            self.fields['balance_history'] = serializers.SerializerMethodField()
            self.fields["cookie_consent"] = serializers.JSONField(required=False, allow_null=True)

    def get_is_owner(self, obj):
        return obj.is_owner

    def get_can_withdraw_balance(self, obj):
        request = self.context.get('request')
        if not request or request.user != obj.user:
            return None
        return obj.can_withdraw_balance()

    def get_role_self_promotion_allowed(self, obj):
        return is_role_self_promotion_allowed()

    def get_balance_history(self, obj):
        if obj.is_owner:
            return BalanceLogSerializer(
                obj.get_balance_history(),
                many=True
            ).data
        return None

    def get_profile_image_small(self, obj):
        """Отримання маленького зображення профілю з fallback"""
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.get_profile_image('small'))
        return obj.get_profile_image('small')
    
    def get_profile_image_large(self, obj):
        """Отримання великого зображення профілю з fallback"""
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.get_profile_image('large'))
        return obj.get_profile_image('large')
    
    def get_has_custom_image(self, obj):
        """Перевірка чи є кастомне зображення"""
        return obj.has_custom_image()

    def get_total_characters(self, obj):
        return Chapter.objects.filter(book__owner=obj.user).aggregate(
            total=models.Sum('characters_count'))['total'] or 0

    def get_total_chapters(self, obj):
        return Chapter.objects.filter(book__owner=obj.user).count()

    def get_free_chapters(self, obj):
        return Chapter.objects.filter(book__owner=obj.user, price=0).count()

    def get_total_author(self, obj):
        return Book.objects.filter(
            owner=obj.user,
            book_type='AUTHOR'
        ).count()

    def get_role(self, obj):
        # Використовуємо поле role з моделі Profile замість груп
        return obj.role

    def get_total_translations(self, obj):
        return Book.objects.filter(
            owner=obj.user,
            book_type='TRANSLATION'
        ).count()

    def get_read_chapters(self, obj):
        from apps.monitoring.models import UserChapterProgress
        return UserChapterProgress.objects.filter(
            user=obj.user, 
            is_read=True
        ).count()

    def get_purchased_chapters(self, obj):
        from apps.monitoring.models import UserChapterProgress
        return UserChapterProgress.objects.filter(
            user=obj.user, 
            is_purchased=True
        ).count()

    def get_completed_books(self, obj):
        from django.db.models import Count, Q, F
        
        books = Book.objects.annotate(
            total_chapters=Count('chapters'),
            read_chapters=Count(
                'chapters',
                filter=Q(
                    chapters__user_progress__user=obj.user,
                    chapters__user_progress__is_read=True
                )
            )
        ).filter(total_chapters__gt=0)
        
        return books.filter(
            total_chapters=F('read_chapters')
        ).count()

    def to_representation(self, instance):
        try:
            data = super().to_representation(instance)
            if instance.image:
                data['image'] = instance.image.url
            return data
        except Exception as e:
            logger.error(f"Error in ProfileSerializer: {str(e)}", exc_info=True)
            raise


class TranslatorListSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username')
    nickname = serializers.CharField(source='user.username')
    image = serializers.ImageField(required=False, allow_null=True)
    books_count = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    last_visit = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ['id', 'username', 'nickname', 'role', 'image', 'books_count', 'comments_count', 'last_visit']

    def get_books_count(self, obj):
        """
        Кількість книг користувача, де він creator або owner,
        а тип книги AUTHOR або TRANSLATION.
        """
        from django.db.models import Q

        return Book.objects.filter(
            Q(creator=obj.user) | Q(owner=obj.user),
            book_type__in=['AUTHOR', 'TRANSLATION']
        ).distinct().count()

    def get_comments_count(self, obj):
        """
        Сумарна кількість коментарів у книгах і главах книг користувача,
        де він creator або owner, а тип книги AUTHOR або TRANSLATION.
        """
        from apps.reviews.models import BookComment, ChapterComment
        from django.db.models import Q

        user_books = Book.objects.filter(
            Q(creator=obj.user) | Q(owner=obj.user),
            book_type__in=['AUTHOR', 'TRANSLATION']
        ).distinct()

        book_comments_count = BookComment.objects.filter(book__in=user_books).count()
        chapter_comments_count = ChapterComment.objects.filter(chapter__book__in=user_books).count()
        return book_comments_count + chapter_comments_count

    def get_last_visit(self, obj):
        """Дата останнього відвідування (last_login, fallback: дата створення профілю)."""
        if obj.user.last_login:
            return obj.user.last_login.strftime('%d.%m.%Y')
        if obj.created:
            return obj.created.strftime('%d.%m.%Y')
        return 'Н/Д'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.image:
            data['image'] = instance.image.url if instance.image else None
        return data


class AuthorListSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username')
    nickname = serializers.CharField(source='user.username')
    books_count = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    last_visit = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ['id', 'username', 'nickname', 'books_count', 'comments_count', 'last_visit']

    def get_books_count(self, obj):
        """Кількість авторських книг, де користувач є creator."""
        return obj.user.created_books.filter(book_type='AUTHOR').count()

    def get_comments_count(self, obj):
        """
        Сумарна кількість коментарів у книгах і главах авторських книг,
        де користувач є creator.
        """
        from apps.reviews.models import BookComment, ChapterComment

        user_books = Book.objects.filter(
            creator=obj.user,
            book_type='AUTHOR'
        )

        book_comments_count = BookComment.objects.filter(book__in=user_books).count()
        chapter_comments_count = ChapterComment.objects.filter(chapter__book__in=user_books).count()
        return book_comments_count + chapter_comments_count

    def get_last_visit(self, obj):
        """Дата останнього відвідування (last_login, fallback: дата створення профілю)."""
        if obj.user.last_login:
            return obj.user.last_login.strftime('%d.%m.%Y')
        if obj.created:
            return obj.created.strftime('%d.%m.%Y')
        return 'Н/Д'


class UsersProfilesSerializer(serializers.ModelSerializer):
    total_books = serializers.SerializerMethodField()   
    username = serializers.CharField(source='user.username')

    class Meta:
        model = Profile
        fields = ['id', 'username', 'role', 'about', 'image', 'total_books']

    def get_total_books(self, obj):
        return obj.user.owned_books.count()

    def to_representation(self, instance):
        try:
            data = super().to_representation(instance)
            if instance.image:
                data['image'] = instance.image.url
            return data
        except Exception as e:
            logger.error(f"Error in UsersProfilesSerializer: {str(e)}", exc_info=True)
            raise


class BalanceOperationSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        min_value=Decimal('0.01'),
        max_value=Decimal(str(getattr(settings, 'MAX_BALANCE_OPERATION_AMOUNT', 1000000)))
    )
    operation_type = serializers.ChoiceField(choices=['deposit', 'withdraw'])

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Сума повинна бути більше нуля")
        return value

    def validate(self, data):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Необхідна авторизація")

        if data['operation_type'] == 'withdraw':
            try:
                profile = user.profile
            except Exception:
                profile = None
            if profile is None:
                raise serializers.ValidationError("Профіль не знайдено")
            if not profile_can_request_balance_withdraw(profile):
                raise serializers.ValidationError(API_WITHDRAW_ROLE_FORBIDDEN_MESSAGE)
            # Не захист від гонки: лише швидкий UX-відсікач; гонку закриває select_for_update у моделі/міксіні.
            if not profile.can_perform_operation('withdraw', data['amount']):
                raise serializers.ValidationError("Недостатньо коштів для виведення")

        return data


class UpdateBalanceSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        min_value=Decimal('0.01'),
        max_value=Decimal(str(getattr(settings, 'MAX_BALANCE_OPERATION_AMOUNT', 1000000)))
    )

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Сума повинна бути більше нуля")
        return value


