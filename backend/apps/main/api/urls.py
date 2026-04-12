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

] + router.urls
