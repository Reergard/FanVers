from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    BookOwnerViewSet, BookReaderViewSet,
    genres_list, tags_list, countries_list, fandoms_list,
    add_chapter, chapter_list, chapter_detail, volume_list,
    create_volume, owned_books, delete_chapter, BookInfoView,
    create_book, update_book, abandoned_translations, user_translations, register_book_view,
    update_book_access_rights, check_book_access
)

router = DefaultRouter()
router.register(r'books/owner', BookOwnerViewSet, basename='book-owner')
router.register(r'books/reader', BookReaderViewSet, basename='book-reader')

app_name = 'catalog'

urlpatterns = [
    path('genres/', genres_list, name='genres_list'),
    path('tags/', tags_list, name='tags_list'),
    path('countries/', countries_list, name='countries_list'),
    path('fandoms/', fandoms_list, name='fandoms_list'),
    path('books/<slug:slug>/add_chapter/', add_chapter, name='add_chapter'),
    path('books/<slug:book_slug>/chapters/', chapter_list, name='chapter_list'),
    path('books/<slug:book_slug>/chapters/<slug:chapter_slug>/', chapter_detail, name='chapter_detail'),
    path('books/<slug:book_slug>/volumes/', volume_list, name='volume_list'),
    path('books/<slug:book_slug>/create-volume/', create_volume, name='create_volume'),
    path('owned-books/', owned_books, name='owned-books'),
    path('user-translations/', user_translations, name='user-translations'),
    path('books/<slug:book_slug>/chapters/<int:chapter_id>/delete/', delete_chapter, name='delete_chapter'),
    path('books/info/<slug:slug>/', BookInfoView.as_view(), name='book-info'),
    path('books/create/', create_book, name='book-create'),
    path('books/<slug:slug>/update/', update_book, name='book-update'),
    path('books/<int:book_id>/view/', register_book_view, name='register-book-view'),
    path('books/<slug:slug>/check-access/', check_book_access, name='check-book-access'),
    path('books/<slug:slug>/access-rights/', update_book_access_rights, name='update-book-access-rights'),
    path('abandoned-translations/', abandoned_translations, name='abandoned-translations'),
] + router.urls
