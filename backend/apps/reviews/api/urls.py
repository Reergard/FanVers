from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookCommentViewSet, ChapterCommentViewSet, LikeDislikeViewSet

router = DefaultRouter()
router.register(r'book/(?P<slug>[-\w]+)/comments', BookCommentViewSet, basename='book-comments')
router.register(r'book/(?P<book_slug>[-\w]+)/chapter/(?P<chapter_slug>[-\w]+)/comments', ChapterCommentViewSet, basename='chapter-comments')
router.register(r'book-comment', LikeDislikeViewSet, basename='book-comment')
router.register(r'chapter-comment', LikeDislikeViewSet, basename='chapter-comment')

urlpatterns = [
    path('', include(router.urls)),
]
