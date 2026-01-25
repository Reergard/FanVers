from django.urls import path
from .views import (
    UserProfileView, ProfileDetailView, update_profile_view,
    ProfileImageView, delete_profile_image, UpdateEmailView,
    change_password, update_notification_settings, get_translators_list,
    get_authors_list, get_user_profile, become_translator, become_author,
    save_token_view, RegisterView, LoginView, LogoutView, AuthStatusView,
    get_user_statistics, CookieTokenRefreshView, get_csrf_token
)
from .balance_views import (
    AddBalanceView, withdraw_balance, update_balance, purchase_chapter
)

app_name = 'users'

urlpatterns = [
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    path('profile/detail/', ProfileDetailView.as_view(), name='profile_detail'),
    path('profile/update/', update_profile_view, name='update_profile'),
    path('profile/upload-image/', ProfileImageView.as_view(), name='upload_profile_image'),
    path('profile/delete-image/', delete_profile_image, name='delete_profile_image'),
    path('profile/update-email/', UpdateEmailView.as_view(), name='update_email'),
    path('profile/change-password/', change_password, name='change_password'),
    path('profile/notification-settings/', update_notification_settings, name='notification_settings'),
    path('profile/statistics/', get_user_statistics, name='user_statistics'),
    
    # Balance operations
    path('add-balance/', AddBalanceView.as_view(), name='add_balance'),
    path('withdraw-balance/', withdraw_balance, name='withdraw_balance'),
    path('update-balance/', update_balance, name='update_balance'),
    path('purchase-chapter/<int:chapter_id>/', purchase_chapter, name='purchase_chapter'),
    
    # Lists
    path('translators/', get_translators_list, name='translators_list'),
    path('authors/', get_authors_list, name='authors_list'),
    path('profile/<str:username>/', get_user_profile, name='get_user_profile'),
    
    # Role changes
    path('become-translator/', become_translator, name='become_translator'),
    path('become-author/', become_author, name='become_author'),
    
    # Auth
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', CookieTokenRefreshView.as_view(), name='refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('auth-status/', AuthStatusView.as_view(), name='auth_status'),
    path('token/save/', save_token_view, name='save_token'),
    path('csrf/', get_csrf_token, name='get_csrf_token'),
]
