from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import ChapterProgressView, UserReadingStatsView, AuthorThanksView

router = DefaultRouter()
app_name = 'monitoring'

urlpatterns = [
    path('chapters/<int:chapter_id>/progress/', 
         ChapterProgressView.as_view(), 
         name='chapter-progress'),
    path('stats/', UserReadingStatsView.as_view(), name='reading-stats'),
    path('thanks/', AuthorThanksView.as_view(), name='author-thanks'),
   
] + router.urls
