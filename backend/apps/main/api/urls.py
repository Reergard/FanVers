from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views


router = DefaultRouter()


app_name = 'main'


urlpatterns = [
    # api/main/..
    path('', views.index, name='index'),
    path('home/', views.home_data, name='home_data'),
    path('books-news/', views.books_news, name='books_news'),
    path('books-recent-updates/', views.books_recent_updates, name='books_recent_updates'),
    path('author-agreement/', views.get_author_agreement, name='author_agreement'),
    path('privacy-policy/', views.get_privacy_policy, name='privacy_policy'),
    path('content-rules/', views.get_content_rules, name='content_rules'),
    path('translator-agreement/', views.get_translator_agreement, name='translator_agreement'),
    path('user-agreement/', views.get_user_agreement, name='user_agreement'),
    path('copyright-holders/', views.get_copyright_holders, name='copyright_holders'),

] + router.urls
