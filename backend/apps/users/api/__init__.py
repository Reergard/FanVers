import logging

logger = logging.getLogger(__name__)

try:
    from . import views
    from .views import (
        save_token_view,
        RegisterView,
        LoginView,
        LogoutView,
        UserProfileView,
        ProfileDetailView,
        update_profile_view,
        ProfileImageView,
        delete_profile_image,
        UpdateEmailView,
        change_password,
        update_notification_settings,
        get_translators_list,
        get_user_profile,
        become_translator,
        AuthStatusView
    )

    __all__ = [
        'save_token_view',
        'RegisterView',
        'LoginView',
        'LogoutView',
        'UserProfileView',
        'ProfileDetailView',
        'update_profile_view',
        'ProfileImageView',
        'delete_profile_image',
        'UpdateEmailView',
        'change_password',
        'update_notification_settings',
        'get_translators_list',
        'get_user_profile',
        'become_translator',
        'AuthStatusView'
    ]

except ImportError as e:
    raise
except Exception as e:
    raise
