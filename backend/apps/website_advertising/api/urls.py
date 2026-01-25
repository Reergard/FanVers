from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdvertisementViewSet

router = DefaultRouter()
router.register('', AdvertisementViewSet, basename='advertisement')

urlpatterns = [
    path('advertisements/', include(router.urls)),
]
