from django.urls import path, include

urlpatterns = [
    path('auth/', include('djoser.urls')),
    path('auth/', include('social_django.urls', namespace='social')),
    path('users/', include('apps.users.api.urls')),
    path('main/', include('apps.main.api.urls')),
    path('catalog/', include('apps.catalog.api.urls')),
    path('chat/', include('apps.chat.api.urls')),
    path('editors/', include('apps.editors.api.urls')),
    path('monitoring/', include('apps.monitoring.api.urls')),
    path('navigation/', include('apps.navigation.api.urls')),
    path('notification/', include('apps.notification.api.urls')),
    path('rating/', include('apps.rating.api.urls')),
    path('reviews/', include('apps.reviews.api.urls')),
    path('search/', include('apps.search.api.urls')),
    path('analytics_books/', include('apps.analytics_books.api.urls')),
    path('website_advertising/', include('apps.website_advertising.api.urls')),
]


