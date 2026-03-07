from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'error-reports', views.ErrorReportViewSet, basename='error-report')

app_name = 'editors'

urlpatterns = [
    path('chapters/<int:chapter_id>/', views.get_chapter_for_edit, name='get-chapter-for-edit'),
    path('chapters/<int:chapter_id>/update/', views.update_chapter, name='update-chapter'),
    path('books/<slug:book_slug>/chapters/reorder/', views.reorder_chapters, name='reorder-chapters'),
    path('books/<slug:book_slug>/chapters/<int:chapter_id>/move/', views.move_chapter, name='move-chapter'),
] + router.urls
