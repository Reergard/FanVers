from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.exceptions import AuthenticationFailed
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
# CSRF защита:
# - LoginView и RegisterView используют @csrf_exempt (не требуют CSRF)
# - CookieTokenRefreshView и LogoutView НЕ используют @csrf_exempt (требуют CSRF через CsrfViewMiddleware)
import logging
from django.db import transaction
from django.contrib.auth import update_session_auth_hash
from django.core.files.storage import default_storage
from django.conf import settings
import os
import time

logger = logging.getLogger(__name__)

# Константи для cookie-based refresh
REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_MAX_AGE = 60 * 60 * 24 * 7  # 7 днів

def _cookie_params():
    """
    Параметри для refresh cookie
    ВАЖНО: Настройки зависят от DEBUG режима для правильной работы в dev/prod
    Согласовано с CSRF_COOKIE_* настройками в settings.py
    """
    import os
    # Secure: только HTTPS в продакшене
    secure = not settings.DEBUG
    
    # SameSite: берем из settings или env, по умолчанию None для кросс-сайт (Telegram/WebView)
    # Должно совпадать с CSRF_COOKIE_SAMESITE в settings.py
    samesite = getattr(settings, 'CSRF_COOKIE_SAMESITE', os.getenv('SAME_SITE_COOKIE', 'None'))
    
    # Domain: берем из settings или env, по умолчанию .fan-vers.com в prod
    # Должно совпадать с SESSION_COOKIE_DOMAIN и CSRF_COOKIE_DOMAIN в settings.py
    domain = None
    if not settings.DEBUG:
        domain = getattr(settings, 'SESSION_COOKIE_DOMAIN', os.getenv('SESSION_COOKIE_DOMAIN', '.fan-vers.com'))
    
    logger.info(f"🔐 [CookieParams] Cookie parameters: secure={secure}, samesite={samesite}, domain={domain or 'None'}")
    
    return dict(
        httponly=True,
        secure=secure,
        samesite=samesite,
        domain=domain,  # None в dev, .fan-vers.com в prod
        path='/',       # кука видна всьому сайту
        max_age=REFRESH_MAX_AGE,
    )

def set_refresh_cookie(response, refresh_str: str):
    """Встановити refresh cookie"""
    params = _cookie_params()
    logger.info(f"🍪 [set_refresh_cookie] Устанавливаем refresh cookie...")
    logger.info(f"🍪 [set_refresh_cookie] Cookie name: {REFRESH_COOKIE_NAME}")
    logger.info(f"🍪 [set_refresh_cookie] Cookie params: {params}")
    logger.info(f"🍪 [set_refresh_cookie] Refresh token length: {len(refresh_str)}")
    response.set_cookie(REFRESH_COOKIE_NAME, refresh_str, **params)
    logger.info(f"🍪 [set_refresh_cookie] Refresh cookie установлена")

def del_refresh_cookie(response):
    """Видалити refresh cookie
    ВАЖНО: Используем те же параметры (domain/path/samesite), что и при установке,
    иначе браузер не удалит старую куку
    """
    params = _cookie_params()
    logger.info(f"🍪 [del_refresh_cookie] Удаляем refresh cookie...")
    logger.info(f"🍪 [del_refresh_cookie] Cookie name: {REFRESH_COOKIE_NAME}")
    logger.info(f"🍪 [del_refresh_cookie] Cookie params: path={params['path']}, domain={params.get('domain', 'None')}, samesite={params.get('samesite', 'None')}")
    # delete_cookie требует те же параметры, что и set_cookie
    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        path=params["path"],
        domain=params.get("domain"),  # Может быть None
        samesite=params.get("samesite", "None")
    )
    logger.info(f"🍪 [del_refresh_cookie] Refresh cookie удалена")

from apps.users.api.serializers import (
    ProfileSerializer, 
    TranslatorListSerializer, 
    AuthorListSerializer,
    UsersProfilesSerializer,
    CreateUserSerializer,
    ProfileImageUploadSerializer,
    EmailUpdateSerializer,
    PasswordChangeSerializer,
    NotificationSettingsSerializer
)
from apps.users.models import Profile
# Удаляем импорт старых throttling классов

# Получаем модель User через get_user_model()
User = get_user_model()


@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    """
    Endpoint для получения CSRF token.
    
    ВАЖНО:
    - GET запросы НЕ требуют CSRF проверки (CsrfViewMiddleware пропускает GET)
    - Django автоматически устанавливает csrftoken cookie при первом запросе через CsrfViewMiddleware
    - get_token(request) возвращает токен из cookie или создает новый, если cookie нет
    - Токен возвращается в теле ответа для использования в заголовке X-CSRFToken
    
    Использование:
    - Фронтенд вызывает GET /api/users/csrf/ при загрузке
    - Получает токен из ответа и сохраняет в памяти
    - Отправляет токен в заголовке X-CSRFToken для всех POST/PUT/PATCH/DELETE запросов
    """
    logger.info(f"🛡️ [get_csrf_token] === START ===")
    logger.info(f"🛡️ [get_csrf_token] Method: {request.method}")
    logger.info(f"🛡️ [get_csrf_token] Path: {request.path}")
    logger.info(f"🛡️ [get_csrf_token] CSRF cookie в запросе: {request.COOKIES.get('csrftoken', 'NOT SET')[:50] if request.COOKIES.get('csrftoken') else 'NOT SET'}")
    
    from django.middleware.csrf import get_token
    csrf_token = get_token(request)
    
    logger.info(f"🛡️ [get_csrf_token] CSRF token получен: {csrf_token[:50] if csrf_token else 'NULL'}...")
    logger.info(f"🛡️ [get_csrf_token] CSRF token length: {len(csrf_token) if csrf_token else 0}")
    logger.info(f"🛡️ [get_csrf_token] === SUCCESS ===")
    
    return Response({"csrfToken": csrf_token})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_token_view(request):
    """Збереження FCM токену для push-сповіщень"""
    token = request.data.get('token')
    user = request.user
    if user.is_authenticated and token:
        profile = user.profile
        profile.token = token
        profile.save()
        return Response({'message': 'Токен успішно збережено'})
    return Response(
        {'message': 'Невірний токен або користувач'}, 
        status=status.HTTP_400_BAD_REQUEST
    )


@method_decorator(csrf_exempt, name='dispatch')
class RegisterView(APIView):
    # throttle_classes = [ProfileThrottle]  # Розкоментувати на продакшені

    permission_classes = [AllowAny]
    authentication_classes = []  # чтобы CSRF/Session не мешали на JWT-эндпоинте

    def post(self, request):
        logger.info(f"📝 [RegisterView] === START REGISTER ===")
        logger.info(f"📝 [RegisterView] Method: {request.method}")
        logger.info(f"📝 [RegisterView] Path: {request.path}")
        logger.info(f"📝 [RegisterView] Headers: {dict(request.headers)}")
        logger.info(f"📝 [RegisterView] Data: username={request.data.get('username', 'N/A')}, email={request.data.get('email', 'N/A')}")
        logger.info(f"📝 [RegisterView] META REMOTE_ADDR: {request.META.get('REMOTE_ADDR')}")
        logger.info(f"📝 [RegisterView] META HTTP_ORIGIN: {request.META.get('HTTP_ORIGIN')}")
        
        serializer = CreateUserSerializer(data=request.data)
        if serializer.is_valid():
            logger.info(f"📝 [RegisterView] Шаг 1: Serializer валиден, создаем пользователя...")
            user = serializer.save()
            logger.info(f"📝 [RegisterView] Шаг 1: Пользователь создан: {user.username} (ID: {user.id})")
            
            logger.info(f"📝 [RegisterView] Шаг 2: Генерируем токены...")
            refresh = RefreshToken.for_user(user)
            access = str(refresh.access_token)
            logger.info(f"📝 [RegisterView] Шаг 2: Токены созданы, access length: {len(access)}")

            logger.info(f"📝 [RegisterView] Шаг 3: Формируем ответ...")
            resp = Response({
                'user': serializer.data,
                'access': access,
                # можно оставить 'refresh' в теле или убрать — фронт его не читает
                # 'refresh': str(refresh),
            }, status=status.HTTP_201_CREATED)

            # ВАЖНО: ставим refresh в HttpOnly cookie (как в LoginView)
            logger.info(f"📝 [RegisterView] Шаг 4: Устанавливаем refresh cookie...")
            set_refresh_cookie(resp, str(refresh))
            logger.info(f"📝 [RegisterView] Шаг 4: Refresh cookie установлена")
            logger.info(f"📝 [RegisterView] === REGISTER SUCCESS ===")
            return resp

        logger.error(f"📝 [RegisterView] Serializer не валиден: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_login"

    def post(self, request):
        logger.info(f"🔐 [LoginView] === START LOGIN REQUEST ===")
        logger.info(f"🔐 [LoginView] Method: {request.method}")
        logger.info(f"🔐 [LoginView] Path: {request.path}")
        logger.info(f"🔐 [LoginView] Headers: {dict(request.headers)}")
        logger.info(f"🔐 [LoginView] META REMOTE_ADDR: {request.META.get('REMOTE_ADDR')}")
        logger.info(f"🔐 [LoginView] META HTTP_X_FORWARDED_FOR: {request.META.get('HTTP_X_FORWARDED_FOR')}")
        logger.info(f"🔐 [LoginView] META HTTP_ORIGIN: {request.META.get('HTTP_ORIGIN')}")
        logger.info(f"🔐 [LoginView] META HTTP_REFERER: {request.META.get('HTTP_REFERER')}")
        logger.info(f"🔐 [LoginView] CSRF token in cookies: {request.COOKIES.get('csrftoken', 'NOT SET')[:50] if request.COOKIES.get('csrftoken') else 'NOT SET'}")
        logger.info(f"🔐 [LoginView] X-CSRFToken header: {request.headers.get('X-CSRFToken', 'NOT SET')[:50] if request.headers.get('X-CSRFToken') else 'NOT SET'}")
        logger.info(f"🔐 [LoginView] X-Requested-With header: {request.headers.get('X-Requested-With', 'NOT SET')}")
        
        username = request.data.get('username')
        password = request.data.get('password')
        
        logger.info(f"🔐 [LoginView] Username received: {username}")
        logger.info(f"🔐 [LoginView] Password received: {'***' if password else 'NOT SET'}")
        
        try:
            logger.info(f"🔐 [LoginView] Шаг 1: Аутентификация пользователя...")
            user = authenticate(request, username=username, password=password)
            logger.info(f"🔐 [LoginView] Шаг 1: Authenticate result: {user.username if user else 'FAILED'}")
            
            if not user:
                logger.warning(f"🔐 [LoginView] Шаг 1: Authentication failed for username: {username}")
                raise AuthenticationFailed("Невірні облікові дані")

            # Проверка активации аккаунта (критично для email-регистрации)
            if not user.is_active:
                logger.warning(f"🔐 [LoginView] Шаг 1: Account not activated for username: {username}")
                return Response(
                    {"detail": "Аккаунт не активирован. Пожалуйста, подтвердите email."},
                    status=status.HTTP_403_FORBIDDEN
                )

            logger.info(f"🔐 [LoginView] Шаг 1: User authenticated: {user.username} (ID: {user.id}, is_active: {user.is_active})")
            
            logger.info(f"🔐 [LoginView] Шаг 2: Генерируем токены...")
            refresh = RefreshToken.for_user(user)
            access = str(refresh.access_token)
            logger.info(f"🔐 [LoginView] Шаг 2: Tokens generated, access length: {len(access)}")
            
            logger.info(f"🔐 [LoginView] Шаг 3: Формируем ответ...")
            resp = Response({"access": access}, status=status.HTTP_200_OK)
            
            logger.info(f"🔐 [LoginView] Шаг 4: Устанавливаем refresh cookie...")
            set_refresh_cookie(resp, str(refresh))
            logger.info(f"🔐 [LoginView] Шаг 4: Refresh cookie установлена")
            logger.info(f"🔐 [LoginView] === LOGIN SUCCESS ===")
            return resp
        except AuthenticationFailed as e:
            logger.error(f"🔐 [LoginView] AuthenticationFailed: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"🔐 [LoginView] Unexpected error: {str(e)}", exc_info=True)
            raise


class LogoutView(APIView):
    """
    Выход из системы.
    CSRF защита включена - использует refresh cookie, поэтому нужна защита.
    """
    permission_classes = [AllowAny]  # Более дружелюбный логаут
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_logout"

    def post(self, request):
        logger.info(f"🚪 [LogoutView] === START LOGOUT ===")
        logger.info(f"🚪 [LogoutView] Method: {request.method}")
        logger.info(f"🚪 [LogoutView] Path: {request.path}")
        logger.info(f"🚪 [LogoutView] Headers: X-CSRFToken={request.headers.get('X-CSRFToken', 'NOT SET')[:50] if request.headers.get('X-CSRFToken') else 'NOT SET'}")
        logger.info(f"🚪 [LogoutView] CSRF token проверен Django middleware - запрос дошел до view")
        
        # Пытаемся заблэклистить refresh из cookie
        logger.info(f"🚪 [LogoutView] Шаг 1: Проверяем refresh cookie...")
        refresh_cookie = request.COOKIES.get(REFRESH_COOKIE_NAME)
        logger.info(f"🚪 [LogoutView] Шаг 1: Refresh cookie: {'PRESENT' if refresh_cookie else 'NOT SET'}")
        
        if refresh_cookie:
            try:
                logger.info(f"🚪 [LogoutView] Шаг 2: Добавляем refresh token в blacklist...")
                token = RefreshToken(refresh_cookie)
                token.blacklist()
                logger.info(f"🚪 [LogoutView] Шаг 2: Refresh token добавлен в blacklist")
            except Exception as e:
                logger.warning(f"🚪 [LogoutView] Шаг 2: Не удалось добавить в blacklist: {e}")

        logger.info(f"🚪 [LogoutView] Шаг 3: Удаляем refresh cookie...")
        resp = Response(status=status.HTTP_205_RESET_CONTENT)
        del_refresh_cookie(resp)
        logger.info(f"🚪 [LogoutView] Шаг 3: Refresh cookie удалена")
        logger.info(f"🚪 [LogoutView] === LOGOUT SUCCESS ===")
        return resp


class CookieTokenRefreshView(APIView):
    """
    Обновление access токена через refresh cookie.
    CSRF защита включена - использует refresh cookie, поэтому нужна защита.
    Django CsrfViewMiddleware автоматически проверит CSRF token из заголовка X-CSRFToken.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_refresh"

    def post(self, request):
        logger.info(f"🔐 [CookieTokenRefreshView] === START REFRESH REQUEST ===")
        logger.info(f"🔐 [CookieTokenRefreshView] Method: {request.method}")
        logger.info(f"🔐 [CookieTokenRefreshView] Path: {request.path}")
        logger.info(f"🔐 [CookieTokenRefreshView] Headers: {dict(request.headers)}")
        logger.info(f"🔐 [CookieTokenRefreshView] X-CSRFToken header: {request.headers.get('X-CSRFToken', 'NOT SET')[:50] if request.headers.get('X-CSRFToken') else 'NOT SET'}")
        logger.info(f"🔐 [CookieTokenRefreshView] CSRF token in cookies: {request.COOKIES.get('csrftoken', 'NOT SET')[:50] if request.COOKIES.get('csrftoken') else 'NOT SET'}")
        logger.info(f"🔐 [CookieTokenRefreshView] CSRF token проверен Django middleware - запрос дошел до view")
        
        logger.info(f"🔐 [CookieTokenRefreshView] Шаг 1: Проверяем refresh cookie...")
        refresh_cookie = request.COOKIES.get(REFRESH_COOKIE_NAME)
        logger.info(f"🔐 [CookieTokenRefreshView] Шаг 1: Refresh cookie: {'PRESENT' if refresh_cookie else 'NOT SET'}")
        
        if not refresh_cookie:
            logger.warning(f"🔐 [CookieTokenRefreshView] Шаг 1: No refresh cookie")
            return Response({"detail": "No refresh cookie"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            logger.info(f"🔐 [CookieTokenRefreshView] Шаг 2: Валидируем refresh token...")
            old = RefreshToken(refresh_cookie)
            logger.info(f"🔐 [CookieTokenRefreshView] Шаг 2: Refresh token валиден")
            
            # Ротация: заносим старый в blacklist (если включен), выдаем новый refresh и access
            try:
                logger.info(f"🔐 [CookieTokenRefreshView] Шаг 3: Добавляем старый refresh token в blacklist...")
                old.blacklist()
                logger.info(f"🔐 [CookieTokenRefreshView] Шаг 3: Старый refresh token добавлен в blacklist")
            except Exception as e:
                logger.warning(f"🔐 [CookieTokenRefreshView] Шаг 3: Не удалось добавить в blacklist: {e}")

            logger.info(f"🔐 [CookieTokenRefreshView] Шаг 4: Получаем user_id из токена...")
            user_id = old.get("user_id")
            logger.info(f"🔐 [CookieTokenRefreshView] Шаг 4: User ID: {user_id}")
            
            User = get_user_model()
            user = User.objects.get(id=user_id)
            logger.info(f"🔐 [CookieTokenRefreshView] Шаг 4: User найден: {user.username}")

            logger.info(f"🔐 [CookieTokenRefreshView] Шаг 5: Генерируем новые токены...")
            new_refresh = RefreshToken.for_user(user)
            new_access = str(new_refresh.access_token)
            logger.info(f"🔐 [CookieTokenRefreshView] Шаг 5: Новые токены созданы, access length: {len(new_access)}")

            logger.info(f"🔐 [CookieTokenRefreshView] Шаг 6: Формируем ответ и устанавливаем cookie...")
            resp = Response({"access": new_access}, status=status.HTTP_200_OK)
            set_refresh_cookie(resp, str(new_refresh))
            logger.info(f"🔐 [CookieTokenRefreshView] Шаг 6: Refresh cookie установлена")
            logger.info(f"🔐 [CookieTokenRefreshView] === REFRESH SUCCESS ===")
            return resp

        except Exception as e:
            logger.error(f"🔐 [CookieTokenRefreshView] Invalid refresh token: {str(e)}", exc_info=True)
            return Response({"detail": "Invalid refresh"}, status=status.HTTP_401_UNAUTHORIZED)


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'profile'

    def get(self, request):
        logger.info(f"👤 [UserProfileView] === START GET PROFILE ===")
        logger.info(f"👤 [UserProfileView] User: {request.user.username if request.user.is_authenticated else 'NOT AUTHENTICATED'}")
        logger.info(f"👤 [UserProfileView] User ID: {request.user.id if request.user.is_authenticated else 'N/A'}")
        logger.info(f"👤 [UserProfileView] Headers: Authorization={request.headers.get('Authorization', 'NOT SET')[:50] if request.headers.get('Authorization') else 'NOT SET'}")
        logger.info(f"👤 [UserProfileView] Query params: {dict(request.query_params)}")
        
        try:
            requested_username = request.query_params.get('username')
            if requested_username:
                logger.info(f"👤 [UserProfileView] Шаг 1: Запрос профиля для username: {requested_username}")
                profile = Profile.objects.select_related('user').get(
                    user__username=requested_username
                )
            else:
                logger.info(f"👤 [UserProfileView] Шаг 1: Запрос собственного профиля")
                profile = request.user.profile
            
            is_owner = not requested_username or requested_username == request.user.username
            
            logger.info(f"👤 [UserProfileView] Шаг 2: Profile found: ID={profile.id}, username={profile.user.username}")
            logger.info(f"👤 [UserProfileView] Шаг 2: Is owner: {is_owner}")
            
            logger.info(f"👤 [UserProfileView] Шаг 3: Сериализуем профиль...")
            serializer = ProfileSerializer(
                profile, 
                context={
                    'is_owner': is_owner,
                    'request': request
                }
            )
            
            logger.info(f"👤 [UserProfileView] === PROFILE SUCCESS ===")
            return Response(serializer.data)
            
        except Profile.DoesNotExist:
            logger.error(f"👤 [UserProfileView] Profile not found for username: {requested_username}")
            return Response(
                {'error': 'Профіль не знайдено'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"👤 [UserProfileView] Помилка: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Внутрішня помилка сервера'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProfileDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    # throttle_classes = [ProfileThrottle]  # Розкоментувати на продакшені

    def get_object(self):
        return self.request.user.profile


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
# @throttle_classes([ProfileThrottle])  # Розкоментувати на продакшені
def update_profile_view(request):
    try:
        profile = request.user.profile
        serializer = ProfileSerializer(
            profile, 
            data=request.data, 
            partial=True,
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Помилка оновлення профілю: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Помилка при оновленні профілю'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class ProfileImageView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'upload'  # Загрузка файлов
    
    def post(self, request):
        """Завантаження зображення профілю з покращеною безпекою"""
        try:
            serializer = ProfileImageUploadSerializer(data=request.data, context={'request': request})
            if serializer.is_valid():
                # Використовуємо метод save з serializer'а
                profile = serializer.save()
                
                return Response({
                    'message': 'Зображення профілю успішно оновлено',
                    'image_url': request.build_absolute_uri(profile.image.url) + f'?v={int(time.time())}',
                    'has_custom_image': True
                })
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Помилка завантаження зображення: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Помилка при завантаженні зображення'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_profile_image(request):
    """Видалення зображення профілю"""
    try:
        profile = request.user.profile
        
        if profile.image:
            # Використовуємо storage з profile.image для кращої сумісності
            storage = profile.image.storage
            if storage.exists(profile.image.name):
                storage.delete(profile.image.name)
            
            # Просто очищаем поле image
            profile.image = None
            profile.save(update_fields=['image'])
            
            return Response({'message': 'Зображення профілю успішно видалено'})
        
        return Response(
            {'error': 'Зображення профілю не знайдено'}, 
            status=status.HTTP_404_NOT_FOUND
        )
        
    except Exception as e:
        logger.error(f"Помилка видалення зображення: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Помилка при видаленні зображення'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class UpdateEmailView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    http_method_names = ['post', 'options']
    # throttle_classes = [ProfileThrottle]  # Розкоментувати на продакшені

    def post(self, request):
        logger.info(f"📧 [UpdateEmailView] === START EMAIL UPDATE ===")
        logger.info(f"📧 [UpdateEmailView] Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"📧 [UpdateEmailView] User: {request.user.username} (ID: {request.user.id})")
        logger.info(f"📧 [UpdateEmailView] Current email: {request.user.email}")
        
        try:
            serializer = EmailUpdateSerializer(data=request.data, context={'request': request})
            
            if serializer.is_valid():
                logger.info(f"📧 [UpdateEmailView] Шаг 1: Serializer валиден")
                user = request.user
                new_email = serializer.validated_data['new_email']
                logger.info(f"📧 [UpdateEmailView] Шаг 1: Новый email: {new_email}")
                
                # Оновлюємо email в User - Profile.email оновиться автоматично через сигнал
                old_email = user.email
                logger.info(f"📧 [UpdateEmailView] Шаг 2: Старый email: {old_email}")
                user.email = new_email
                
                # Сохраняем с указанием конкретного поля для избежания конфликтов
                logger.info(f"📧 [UpdateEmailView] Шаг 3: Сохраняем новый email...")
                user.save(update_fields=['email'])
                logger.info(f"📧 [UpdateEmailView] Шаг 3: Email сохранен")
                
                # Djoser может отправить confirmation email если USERNAME_CHANGED_EMAIL_CONFIRMATION=True
                logger.info(f"📧 [UpdateEmailView] Шаг 4: Djoser может отправить confirmation email (если USERNAME_CHANGED_EMAIL_CONFIRMATION=True)")
                logger.info(f"📧 [UpdateEmailView] === EMAIL UPDATE SUCCESS ===")
                
                response_data = {
                    'message': 'Email успішно оновлено',
                    'new_email': new_email
                }
                return Response(response_data)
            else:
                logger.error(f"📧 [UpdateEmailView] Serializer не валиден: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"📧 [UpdateEmailView] Ошибка при обновлении email: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Помилка при оновленні email'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Зміна пароля користувача"""
    try:
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = request.user
            new_password = serializer.validated_data['new_password']
            
            # Змінюємо пароль
            user.set_password(new_password)
            user.save()
            
            # Оновлюємо сесію
            update_session_auth_hash(request, user)
            
            return Response({'message': 'Пароль успішно змінено'})
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Помилка зміни пароля: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Помилка при зміні пароля'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_notification_settings(request):
    """Оновлення налаштувань сповіщений"""
    try:
        profile = request.user.profile
        serializer = NotificationSettingsSerializer(
            profile, 
            data=request.data, 
            partial=True
        )
        
        if serializer.is_valid():
            serializer.save()
            return Response({
                'message': 'Налаштування сповіщений успішно оновлено',
                'settings': serializer.data
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Помилка оновлення налаштувань: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Помилка при оновленні налаштувань'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_translators_list(request):
    try:
        # Отримуємо ВСІХ перекладачів за роллю (навіть без книг)
        translators_by_role = Profile.objects.filter(
            role='Перекладач'
        ).select_related('user')

        # Отримуємо ТІЛЬКИ літераторів, які мають книги з типом TRANSLATION
        literators_with_translations = Profile.objects.filter(
            role='Літератор',
            user__owned_books__book_type='TRANSLATION'
        ).select_related('user').distinct()

        # Об'єднуємо результати
        all_translators = list(translators_by_role) + list(literators_with_translations)
        
        # Видаляємо дублікати та сортуємо за кількістю книг
        unique_translators = list({translator.id: translator for translator in all_translators}.values())
        
        # Сортуємо за кількістю книг перекладів (спочатку ті, у кого більше книг)
        unique_translators.sort(
            key=lambda x: x.user.owned_books.filter(book_type='TRANSLATION').count(),
            reverse=True
        )
        
        serializer = TranslatorListSerializer(unique_translators, many=True)
        return Response(serializer.data)
        
    except Exception as e:
        logger.error(f"Помилка в get_translators_list: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Внутрішня помилка сервера'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_authors_list(request):
    try:
        # Додаємо діагностичне логування
        total_profiles = Profile.objects.count()
        total_literators = Profile.objects.filter(role='Літератор').count()
        total_translators = Profile.objects.filter(role='Перекладач').count()
        total_readers = Profile.objects.filter(role='Читач').count()
        
        logger.info(f"Діагностика ролей: Всього профілів: {total_profiles}, "
                   f"Літераторів: {total_literators}, "
                   f"Перекладачів: {total_translators}, "
                   f"Читачів: {total_readers}")
        
        # Отримуємо тільки літераторів (перевіряємо обидва варіанти)
        authors = Profile.objects.filter(
            role__in=['Літератор', 'Литератор', 'Author']
        ).select_related('user').prefetch_related(
            'user__created_books',
            'user__owned_books'
        )
        
        logger.info(f"Знайдено літераторів: {authors.count()}")
        
        # Сортуємо за кількістю авторських книг (спочатку ті, у кого більше книг)
        authors_list = list(authors)
        authors_list.sort(
            key=lambda x: x.user.created_books.filter(book_type='AUTHOR').count(),
            reverse=True
        )
        
        serializer = AuthorListSerializer(authors_list, many=True)
        logger.info(f"Успішно серіалізовано {len(serializer.data)} авторів")
        return Response(serializer.data)
        
    except Exception as e:
        logger.error(f"Помилка в get_authors_list: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Внутрішня помилка сервера'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
# @throttle_classes([ProfileThrottle])  # Розкоментувати на продакшені
def get_user_profile(request, username):
    try:
        profile = Profile.objects.select_related('user').get(
            user__username=username
        )
        
        serializer = UsersProfilesSerializer(profile)
        return Response(serializer.data)
        
    except Profile.DoesNotExist:
        return Response(
            {'error': 'Профіль не знайдено'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Помилка в get_user_profile: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Внутрішня помилка сервера'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
# @throttle_classes([ProfileThrottle])  # Розкоментувати на продакшені
def become_translator(request):
    try:
        user = request.user
        profile = user.profile
        
        # Проверяем текущую роль
        if profile.role == 'Перекладач':
            return Response({
                'error': 'Ви вже є перекладачем'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            profile.role = 'Перекладач'
            profile.save()
        
        return Response({
            'message': 'Ви успішно стали перекладачем',
            'role': profile.role
        })
    except Exception as e:
        logger.error(f"Помилка в become_translator: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Помилка при зміні ролі'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
# @throttle_classes([ProfileThrottle])  # Розкоментувати на продакшені
def become_author(request):
    try:
        user = request.user
        profile = user.profile
        
        # Проверяем текущую роль
        if profile.role == 'Літератор':
            return Response({
                'error': 'Ви вже є літератором'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            profile.role = 'Літератор'
            profile.save()
        
        return Response({
            'message': 'Ви успішно стали літератором',
            'role': profile.role
        })
    except Exception as e:
        logger.error(f"Помилка в become_author: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Помилка при зміні ролі'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class AuthStatusView(APIView):
    """
    Проверка статуса аутентификации.
    Требует валидный access токен в заголовке Authorization.
    Если токена нет или он невалиден - вернется 401, фронт должен сделать refresh.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    # throttle_classes = [ProfileThrottle]  # Розкоментувати на продакшені

    def get(self, request):
        # Если дошли сюда - значит access токен валиден и пользователь аутентифицирован
        return Response({'isAuthenticated': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_statistics(request):
    """API для отримання статистики користувача по перекладах"""
    try:
        user = request.user
        profile = user.profile
        
        # Получаем все книги пользователя
        user_books = user.owned_books.all()
        
        # Статистика по всем книгам
        total_books_count = user_books.count()
        
        # Статистика по главам и символам
        from apps.catalog.models import Chapter
        from django.db.models import Sum, Count, Value
        from django.db.models.functions import Coalesce
        
        chapters_stats = Chapter.objects.filter(book__owner=user).aggregate(
            total_chapters=Count('id'),
            total_characters=Coalesce(Sum('characters_count'), Value(0))
        )
        
        # Статистика по доходам (покупки глав)
        from apps.monitoring.models import TransactionLog
        from django.utils import timezone
        from datetime import datetime, timedelta
        
        today = timezone.now().date()
        month_start = today.replace(day=1)
        
        # Доход за день
        daily_income = TransactionLog.objects.filter(
            owner=profile,
            created_at__date=today
        ).aggregate(
            total=Sum('final_amount')
        )['total'] or 0
        
        # Доход за месяц
        monthly_income = TransactionLog.objects.filter(
            owner=profile,
            created_at__date__gte=month_start
        ).aggregate(
            total=Sum('final_amount')
        )['total'] or 0
        
        # Статистика по просмотрам (если есть)
        from apps.monitoring.models import BookView
        daily_views = BookView.objects.filter(
            book__owner=user,
            viewed_at__date=today
        ).values('book').distinct().count()
        
        # Дата последней активности (последняя покупка, комментарий и т.д.)
        last_activity = None
        
        # Ищем последнюю активность в разных источниках
        last_purchase = TransactionLog.objects.filter(
            owner=profile
        ).order_by('-created_at').first()
        
        if last_purchase:
            last_activity = last_purchase.created_at
        
        # Если нет покупок, используем дату последней главы
        if not last_activity:
            last_chapter = Chapter.objects.filter(
                book__owner=user
            ).order_by('-created_at').first()
            
            if last_chapter:
                last_activity = last_chapter.created_at
        
        # Если нет глав, используем дату создания первой книги
        if not last_activity:
            first_book = user_books.order_by('created_at').first()
            if first_book:
                last_activity = first_book.created_at
        
        statistics = {
            'total_books_count': total_books_count,
            'total_chapters': chapters_stats['total_chapters'],
            'total_characters': chapters_stats['total_characters'],
            'commission': float(profile.commission),
            'daily_income': float(daily_income),
            'monthly_income': float(monthly_income),
            'daily_views': daily_views,
            'last_activity': last_activity.isoformat() if last_activity else None
        }
        
        return Response(statistics)
        
    except Exception as e:
        logger.error(f"Помилка в get_user_statistics: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Внутрішня помилка сервера'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
