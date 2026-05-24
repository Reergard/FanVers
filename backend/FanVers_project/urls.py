from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path(f'{settings.DJANGO_ADMIN_PATH}/', admin.site.urls),
    path('api/', include('apps.api.urls')),
    path('', include('apps.seo.urls')),
]

if settings.DEBUG:
    from django.contrib.staticfiles.urls import staticfiles_urlpatterns

    # Як runserver: статика з INSTALLED_APPS (unfold тощо), не лише з STATIC_ROOT
    urlpatterns += staticfiles_urlpatterns()
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Після реєстрації admin у всіх INSTALLED_APPS (unfold-стилі для celery-beat, authtoken, social_django)
from apps.main.admin_third_party import register_third_party_unfold_admins

register_third_party_unfold_admins()
