from django.contrib.auth import authenticate, login, logout as django_logout
from django.contrib.auth import get_user_model
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.exceptions import AuthenticationFailed
from django.views.decorators.csrf import csrf_exempt, csrf_protect
from django.utils.decorators import method_decorator
# CSRF защита:
# - LoginView и RegisterView используют @csrf_exempt (не требуют CSRF)
# - CookieTokenRefreshView и LogoutView НЕ используют @csrf_exempt (требуют CSRF через CsrfViewMiddleware)
import logging
from django.db import transaction
from django.contrib.auth import update_session_auth_hash
from django.core.files.storage import default_storage
from django.core.cache import cache
from django.shortcuts import redirect
from django.conf import settings

from apps.users.role_self_promotion import is_role_self_promotion_allowed
from apps.users.ws_disconnect import broadcast_user_ws_disconnect
import os
import secrets
import time

logger = logging.getLogger(__name__)

# Константи для cookie-based refresh
REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_MAX_AGE = 60 * 60 * 24 * 7  # 7 днів (remember_me=False) — тиждень бездіяльності
REFRESH_MAX_AGE_REMEMBER = 60 * 60 * 24 * 30  # 30 днів (remember_me=True) — довга сесія

# Служебная cookie, чтобы режим remember_me переживал refresh.
SESSION_MODE_COOKIE_NAME = "session_mode"
SESSION_MODE_DEFAULT = "default"
SESSION_MODE_REMEMBER = "remember"

def _cookie_params(remember_me=False):
    """
    Параметри для refresh cookie
    ВАЖНО: Настройки зависят от DEBUG режима для правильной работы в dev/prod
    Согласовано с CSRF_COOKIE_* настройками в settings.py
    """
    import os
    # Secure: только HTTPS в продакшене
    secure = not settings.DEBUG
    
    # SameSite: берем из settings или env, по умолчанию Lax для dev, None для prod
    # Должно совпадать с CSRF_COOKIE_SAMESITE в settings.py
    samesite = getattr(settings, 'CSRF_COOKIE_SAMESITE', None)
    if samesite is None:
        samesite = os.getenv('SAME_SITE_COOKIE', 'Lax' if settings.DEBUG else 'None')
    
    # Domain: берем из settings или env, по умолчанию .fan-vers.com в prod
    # Должно совпадать с SESSION_COOKIE_DOMAIN и CSRF_COOKIE_DOMAIN в settings.py
    domain = None
    if not settings.DEBUG:
        domain = getattr(settings, 'SESSION_COOKIE_DOMAIN', os.getenv('SESSION_COOKIE_DOMAIN', '.fan-vers.com'))
    
    if settings.DEBUG:
        logger.info(f"🔐 [CookieParams] Cookie parameters: secure={secure}, samesite={samesite}, domain={domain or 'None'}, remember_me={remember_me}")
    
    max_age = REFRESH_MAX_AGE_REMEMBER if remember_me else REFRESH_MAX_AGE
    return dict(
        httponly=True,
        secure=secure,
        samesite=samesite,
        domain=domain,  # None в dev, .fan-vers.com в prod
        path='/',       # кука видна всьому сайту
        max_age=max_age,
    )

def set_refresh_cookie(response, refresh_str: str, remember_me: bool = False):
    """Встановити refresh cookie"""
    params = _cookie_params(remember_me=remember_me)
    if settings.DEBUG:
        logger.info(f"🍪 [set_refresh_cookie] Устанавливаем refresh cookie...")
        logger.info(f"🍪 [set_refresh_cookie] Cookie name: {REFRESH_COOKIE_NAME}")
        logger.info(f"🍪 [set_refresh_cookie] Cookie params: {params}")
    response.set_cookie(REFRESH_COOKIE_NAME, refresh_str, **params)
    if settings.DEBUG:
        logger.info(f"🍪 [set_refresh_cookie] Refresh cookie установлена")

def set_session_mode_cookie(response, remember_me: bool = False):
    params = _cookie_params(remember_me=remember_me)
    response.set_cookie(
        SESSION_MODE_COOKIE_NAME,
        SESSION_MODE_REMEMBER if remember_me else SESSION_MODE_DEFAULT,
        **params
    )

def del_refresh_cookie(response):
    """Видалити refresh cookie
    ВАЖНО: Используем те же параметры (domain/path/samesite), что и при установке,
    иначе браузер не удалит старую куку
    """
    params = _cookie_params(remember_me=False)
    if settings.DEBUG:
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
    if settings.DEBUG:
        logger.info(f"🍪 [del_refresh_cookie] Refresh cookie удалена")

def del_session_mode_cookie(response):
    params = _cookie_params(remember_me=False)
    response.delete_cookie(
        SESSION_MODE_COOKIE_NAME,
        path=params["path"],
        domain=params.get("domain"),
        samesite=params.get("samesite", "None")
    )

from apps.users.api.serializers import (
    ProfileSerializer,
    ProfileAboutUpdateSerializer,
    TranslatorListSerializer,
    AuthorListSerializer,
    UsersProfilesSerializer,
    CreateUserSerializer,
    ProfileImageUploadSerializer,
    EmailUpdateSerializer,
    PasswordChangeSerializer,
    NotificationSettingsSerializer,
    CookieConsentSerializer,
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
    if settings.DEBUG:
        logger.info(
            "[get_csrf_token] %s %s (csrftoken cookie: %s)",
            request.method,
            request.path,
            "present" if request.COOKIES.get("csrftoken") else "absent",
        )

    from django.middleware.csrf import get_token
    csrf_token = get_token(request)

    if settings.DEBUG:
        logger.info("[get_csrf_token] CSRF token issued")
    
    return Response({"csrfToken": csrf_token})


def oauth_complete_redirect(request):
    """
    Після успішного OAuth (Google/Facebook) social-auth редіректить сюди.
    Генеруємо JWT, зберігаємо одноразовий code у cache, редіректимо на фронт з ?code=XXX.
    """
    if not request.user.is_authenticated:
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://127.0.0.1:5173')
        return redirect(f"{frontend_url}/?oauth=error&message=not_authenticated")

    user = request.user
    if not user.is_active:
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://127.0.0.1:5173')
        return redirect(f"{frontend_url}/?oauth=error&message=inactive")

    code = secrets.token_urlsafe(32)
    refresh = RefreshToken.for_user(user)
    access = str(refresh.access_token)
    cache.set(f"oauth_code_{code}", {'user_id': user.id, 'access': access, 'refresh': str(refresh)}, timeout=60)

    # Multiple AUTHENTICATION_BACKENDS are configured (social + ModelBackend),
    # so we must specify which backend to use for a manual session login.
    login(request, user, backend='django.contrib.auth.backends.ModelBackend')
    return redirect(f"{settings.FRONTEND_URL}/oauth/callback?code={code}")


def _oauth_exchange_impl(request):
    code = request.data.get('code')
    if not code:
        return Response({'detail': 'Code required'}, status=status.HTTP_400_BAD_REQUEST)

    data = cache.get(f"oauth_code_{code}")
    if not data:
        return Response({'detail': 'Invalid or expired code'}, status=status.HTTP_401_UNAUTHORIZED)

    cache.delete(f"oauth_code_{code}")
    resp = Response({'access': data['access']})
    # Social login: предсказуемо используем "длинную" сессию.
    remember_me = True
    set_refresh_cookie(resp, data['refresh'], remember_me=remember_me)
    set_session_mode_cookie(resp, remember_me=remember_me)
    return resp


_oauth_exchange_impl.throttle_scope = 'auth_login'
oauth_exchange_view = csrf_exempt(
    api_view(['POST'])(permission_classes([AllowAny])(
        throttle_classes([ScopedRateThrottle])(_oauth_exchange_impl)
    ))
)


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
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_login"  # той самий ліміт, що й login
    authentication_classes = []  # чтобы CSRF/Session не мешали на JWT-эндпоинте

    def post(self, request):
        if settings.DEBUG:
            logger.info(f"📝 [RegisterView] === START REGISTER ===")
            logger.info(f"📝 [RegisterView] Method: {request.method}, Path: {request.path}")
        
        serializer = CreateUserSerializer(data=request.data)
        if serializer.is_valid():
            if settings.DEBUG:
                logger.info(f"📝 [RegisterView] Шаг 1: Serializer валиден, создаем пользователя...")
            user = serializer.save()
            if settings.DEBUG:
                logger.info(f"📝 [RegisterView] Шаг 1: Пользователь создан (user id={user.id})")
                logger.info(f"📝 [RegisterView] Шаг 2: Генерируем токены...")

            # Если включен activation flow и пользователь ещё не активирован —
            # не логиним и не выдаём токены (согласовано с LoginView).
            if not getattr(user, "is_active", True):
                # Отправляем письмо активации (djoser ActivationEmail).
                # RegisterView кастомный, поэтому djoser.perform_create не вызывается —
                # письмо нужно отправлять здесь вручную.
                try:
                    from djoser.email import ActivationEmail
                    ActivationEmail(request, {"user": user}).send(to=[user.email])
                    if settings.DEBUG:
                        logger.info(
                            f"📝 [RegisterView] Activation email отправлен на {user.email}"
                        )
                except Exception as e:
                    logger.error(
                        f"📝 [RegisterView] Ошибка отправки activation email: {str(e)}",
                        exc_info=True,
                    )
                return Response(
                    {"detail": "Реєстрація успішна. Підтвердіть email для входу."},
                    status=status.HTTP_201_CREATED,
                )

            refresh = RefreshToken.for_user(user)
            access = str(refresh.access_token)
            if settings.DEBUG:
                logger.info(f"📝 [RegisterView] Шаг 2: Токены созданы")

            if settings.DEBUG:
                logger.info(f"📝 [RegisterView] Шаг 3: Формируем ответ...")
            remember_me = request.data.get('remember_me', False) in (True, 'true', '1')
            resp = Response({
                'user': serializer.data,
                'access': access,
            }, status=status.HTTP_201_CREATED)

            # Сесія для WebSocket cookie-based auth
            login(request, user, backend='django.contrib.auth.backends.ModelBackend')

            # ВАЖНО: ставим refresh в HttpOnly cookie (як у LoginView)
            if settings.DEBUG:
                logger.info(f"📝 [RegisterView] Шаг 4: Устанавливаем refresh cookie (remember_me={remember_me})...")
            set_refresh_cookie(resp, str(refresh), remember_me=remember_me)
            set_session_mode_cookie(resp, remember_me=remember_me)
            if settings.DEBUG:
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
        if settings.DEBUG:
            logger.info(f"🔐 [LoginView] === START LOGIN REQUEST ===")
            logger.info(f"🔐 [LoginView] Method: {request.method}, Path: {request.path}")
        
        username = request.data.get('username')
        password = request.data.get('password')
        
        try:
            if settings.DEBUG:
                logger.info(f"🔐 [LoginView] Шаг 1: Аутентификация пользователя...")
            user = authenticate(request, username=username, password=password)
            if settings.DEBUG:
                logger.info(f"🔐 [LoginView] Шаг 1: Authenticate result: {'ok' if user else 'FAILED'}")
            
            if not user:
                logger.warning("🔐 [LoginView] Шаг 1: Authentication failed (invalid credentials)")
                raise AuthenticationFailed("Невірні облікові дані")

            # Проверка активации аккаунта (критично для email-регистрации)
            if not user.is_active:
                logger.warning("🔐 [LoginView] Шаг 1: Account not activated")
                return Response(
                    {"detail": "Аккаунт не активирован. Пожалуйста, подтвердите email."},
                    status=status.HTTP_403_FORBIDDEN
                )

            if settings.DEBUG:
                logger.info(f"🔐 [LoginView] Шаг 1: User authenticated (id={user.id})")
                logger.info(f"🔐 [LoginView] Шаг 2: Генерируем токены...")
            refresh = RefreshToken.for_user(user)
            access = str(refresh.access_token)
            if settings.DEBUG:
                logger.info(f"🔐 [LoginView] Шаг 2: Tokens generated")
            
            if settings.DEBUG:
                logger.info(f"🔐 [LoginView] Шаг 3: Формируем ответ...")
            remember_me = request.data.get('remember_me', False) in (True, 'true', '1')
            resp = Response({"access": access}, status=status.HTTP_200_OK)

            # Сесія для WebSocket cookie-based auth
            login(request, user, backend='django.contrib.auth.backends.ModelBackend')

            if settings.DEBUG:
                logger.info(f"🔐 [LoginView] Шаг 4: Устанавливаем refresh cookie (remember_me={remember_me})...")
            set_refresh_cookie(resp, str(refresh), remember_me=remember_me)
            set_session_mode_cookie(resp, remember_me=remember_me)
            if settings.DEBUG:
                logger.info(f"🔐 [LoginView] === LOGIN SUCCESS ===")
            return resp
        except AuthenticationFailed as e:
            logger.error(f"🔐 [LoginView] AuthenticationFailed: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"🔐 [LoginView] Unexpected error: {str(e)}", exc_info=True)
            raise


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    """
    Выход из системы.
    CSRF защита включена - использует refresh cookie, поэтому нужна защита.
    """
    permission_classes = [AllowAny]  # Более дружелюбный логаут
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_logout"

    def post(self, request):
        if settings.DEBUG:
            logger.info(f"🚪 [LogoutView] === START LOGOUT ===")

        refresh_cookie = request.COOKIES.get(REFRESH_COOKIE_NAME)
        user_id_for_ws = None
        if refresh_cookie:
            try:
                user_id_for_ws = RefreshToken(refresh_cookie).get("user_id")
            except Exception:
                pass
        if user_id_for_ws is None and request.user.is_authenticated:
            user_id_for_ws = request.user.pk

        if refresh_cookie:
            try:
                token = RefreshToken(refresh_cookie)
                token.blacklist()
            except Exception as e:
                logger.error("🚪 [LogoutView] Не удалось добавить в blacklist: %s", e, exc_info=True)

        resp = Response(status=status.HTTP_205_RESET_CONTENT)
        # Симметрично завершаем Django-сессию (login() вызывается для WS cookie-based auth)
        try:
            django_logout(request)
        except Exception:
            pass
        if user_id_for_ws:
            broadcast_user_ws_disconnect(int(user_id_for_ws))
        del_refresh_cookie(resp)
        del_session_mode_cookie(resp)
        if settings.DEBUG:
            logger.info(f"🚪 [LogoutView] === LOGOUT SUCCESS ===")
        return resp


@method_decorator(csrf_protect, name="dispatch")
class CookieTokenRefreshView(APIView):
    """
    Обновление access токена через refresh cookie.
    CSRF защита включена - использует refresh cookie, поэтому нужна защита.
    @method_decorator(csrf_protect) принудительно включает проверку CSRF независимо от DRF auth классов.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_refresh"

    def post(self, request):
        if settings.DEBUG:
            logger.info(f"🔐 [CookieTokenRefreshView] === START REFRESH REQUEST ===")
        
        refresh_cookie = request.COOKIES.get(REFRESH_COOKIE_NAME)
        
        if not refresh_cookie:
            logger.warning(f"🔐 [CookieTokenRefreshView] No refresh cookie")
            return Response({"detail": "No refresh cookie"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            old = RefreshToken(refresh_cookie)

            try:
                old.blacklist()
            except Exception as e:
                logger.error(
                    "🔐 [CookieTokenRefreshView] Blacklist failed, refusing new tokens: %s",
                    e,
                    exc_info=True,
                )
                return Response(
                    {"detail": "Token refresh failed"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            user_id = old.get("user_id")
            User = get_user_model()
            user = User.objects.get(id=user_id)

            if not getattr(user, "is_active", True):
                logger.warning(f"🔐 [CookieTokenRefreshView] Inactive user: {user_id}")
                return Response({"detail": "Inactive account"}, status=status.HTTP_401_UNAUTHORIZED)

            if settings.DEBUG:
                logger.info(f"🔐 [CookieTokenRefreshView] Генерируем новые токены...")
            new_refresh = RefreshToken.for_user(user)
            new_access = str(new_refresh.access_token)
            resp = Response({"access": new_access}, status=status.HTTP_200_OK)
            session_mode = request.COOKIES.get(SESSION_MODE_COOKIE_NAME, SESSION_MODE_DEFAULT)
            remember_me = session_mode == SESSION_MODE_REMEMBER
            set_refresh_cookie(resp, str(new_refresh), remember_me=remember_me)
            set_session_mode_cookie(resp, remember_me=remember_me)
            if settings.DEBUG:
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
        if settings.DEBUG:
            uid = request.user.id if request.user.is_authenticated else None
            logger.info("[UserProfileView] profile requested (user_id=%s)", uid)

        try:
            requested_username = request.query_params.get('username')
            if requested_username:
                profile = Profile.objects.select_related('user').get(
                    user__username=requested_username
                )
            else:
                profile = request.user.profile

            is_owner = not requested_username or requested_username == request.user.username

            serializer = ProfileSerializer(
                profile,
                context={
                    'is_owner': is_owner,
                    'request': request
                }
            )

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
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "profile"

    def get_object(self):
        return self.request.user.profile


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@throttle_classes([ScopedRateThrottle])
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


update_profile_view.throttle_scope = "profile_write"


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_profile_about_view(request):
    """Оновлення лише тексту «Про себе» (без інших полів профілю)."""
    try:
        profile = request.user.profile
    except Profile.DoesNotExist:
        return Response(
            {'error': 'Профіль не знайдено'},
            status=status.HTTP_404_NOT_FOUND,
        )
    serializer = ProfileAboutUpdateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {
                'error': 'Помилка валідації',
                'details': serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        text = serializer.validated_data['about']
        with transaction.atomic():
            profile = type(profile).objects.select_for_update().get(pk=profile.pk)
            profile.about = text if text else None
            profile.save(update_fields=['about'])
        response_serializer = ProfileSerializer(profile, context={'request': request})
        return Response(response_serializer.data)
    except Exception as e:
        logger.error(f"Помилка оновлення «Про себе»: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Помилка при збереженні тексту профілю'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


update_profile_about_view = throttle_classes([ScopedRateThrottle])(update_profile_about_view)
update_profile_about_view.throttle_scope = "profile_write"


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
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "profile_write"

    def post(self, request):
        if settings.DEBUG:
            logger.info(
                "[UpdateEmailView] email update attempt (user_id=%s)",
                request.user.id,
            )
        
        try:
            serializer = EmailUpdateSerializer(data=request.data, context={'request': request})
            
            if serializer.is_valid():
                user = request.user
                new_email = serializer.validated_data['new_email']

                # Оновлюємо email в User - Profile.email оновиться автоматично через сигнал
                user.email = new_email

                # Сохраняем с указанием конкретного поля для избежания конфликтов
                user.save(update_fields=['email'])
                if settings.DEBUG:
                    logger.info("[UpdateEmailView] email updated (user_id=%s)", user.id)
                
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
@throttle_classes([ScopedRateThrottle])
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


change_password.throttle_scope = "password_change"


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


update_notification_settings = throttle_classes([ScopedRateThrottle])(update_notification_settings)
update_notification_settings.throttle_scope = "profile_write"


class CookieConsentView(APIView):
    """
    GET/PUT cookie consent for the current user.

    Endpoint is intentionally small to avoid fetching full profile for sync.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "profile"

    def get(self, request):
        try:
            profile = request.user.profile
            return Response({"cookie_consent": profile.cookie_consent})
        except Exception as e:
            logger.error(f"Помилка отримання cookie consent: {str(e)}", exc_info=True)
            return Response(
                {"error": "Помилка при отриманні cookie consent"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def put(self, request):
        try:
            serializer = CookieConsentSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            profile = request.user.profile
            profile.cookie_consent = serializer.to_storage_value()
            profile.save(update_fields=["cookie_consent"])
            return Response({"cookie_consent": profile.cookie_consent})
        except Exception as e:
            logger.error(f"Помилка оновлення cookie consent: {str(e)}", exc_info=True)
            return Response(
                {"error": "Помилка при оновленні cookie consent"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


@api_view(['GET'])
@permission_classes([AllowAny])  # Публічний каталог перекладачів; обмеження — throttling на рівні DRF
def get_translators_list(request):
    try:
        translators = Profile.objects.filter(
            role__in=['Перекладач', 'Літератор']
        ).select_related('user').distinct()

        translators_list = list(translators)
        translators_list.sort(
            key=lambda x: (
                x.user.owned_books.filter(book_type__in=['AUTHOR', 'TRANSLATION']).count()
                + x.user.created_books.filter(book_type__in=['AUTHOR', 'TRANSLATION']).exclude(
                    id__in=x.user.owned_books.values_list('id', flat=True)
                ).count()
            ),
            reverse=True
        )

        serializer = TranslatorListSerializer(translators_list, many=True)
        return Response(serializer.data)
        
    except Exception as e:
        logger.error(f"Помилка в get_translators_list: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Внутрішня помилка сервера'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_authors_list(request):
    try:
        # Отримуємо тільки профілі з роллю "Літератор"
        authors = Profile.objects.filter(
            role='Літератор'
        ).select_related('user').prefetch_related(
            'user__created_books',
            'user__owned_books'
        )

        authors_list = list(authors)
        authors_list.sort(
            key=lambda x: x.user.created_books.filter(book_type='AUTHOR').count(),
            reverse=True
        )

        serializer = AuthorListSerializer(authors_list, many=True)
        return Response(serializer.data)
        
    except Exception as e:
        logger.error(f"Помилка в get_authors_list: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Внутрішня помилка сервера'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def _get_user_profile(request, username):
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


_get_user_profile.throttle_scope = 'profile'
get_user_profile = api_view(['GET'])(permission_classes([AllowAny])(
    throttle_classes([ScopedRateThrottle])(_get_user_profile)
))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ScopedRateThrottle])
def become_translator(request):
    try:
        with transaction.atomic():
            profile = Profile.objects.select_for_update().get(user_id=request.user.pk)
            if profile.role != 'Читач':
                return Response(
                    {'error': 'Стати перекладачем можна лише з ролі «Читач»'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            profile.role = 'Перекладач'
            profile.save(update_fields=['role'])

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


become_translator.throttle_scope = "role_promotion"


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ScopedRateThrottle])
def become_author(request):
    try:
        with transaction.atomic():
            profile = Profile.objects.select_for_update().get(user_id=request.user.pk)
            if profile.role not in ('Читач', 'Перекладач'):
                return Response(
                    {'error': 'Стати літератором можна з ролей «Читач» або «Перекладач»'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            profile.role = 'Літератор'
            profile.save(update_fields=['role'])

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


become_author.throttle_scope = "role_promotion"


class AuthStatusView(APIView):
    """
    Проверка статуса аутентификации.
    Требует валидный access токен в заголовке Authorization.
    Если токена нет или он невалиден - вернется 401, фронт должен сделать refresh.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_status"

    def get(self, request):
        # Если дошли сюда - значит access токен валиден и пользователь аутентифицирован
        user_role = 'Читач'
        has_active_payout_profile = False
        try:
            profile = request.user.profile
            balance = str(profile.balance)
            can_withdraw_balance = profile.can_withdraw_balance()
            user_role = profile.role
            has_active_payout_profile = profile.has_active_payout_profile
        except (Profile.DoesNotExist, AttributeError):
            balance = '0'
            can_withdraw_balance = False
        return Response({
            'isAuthenticated': True,
            'userId': request.user.id,
            'username': request.user.username,
            'balance': balance,
            'can_withdraw_balance': can_withdraw_balance,
            'has_active_payout_profile': has_active_payout_profile,
            'role_self_promotion_allowed': is_role_self_promotion_allowed(),
            'role': user_role,
        })


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
