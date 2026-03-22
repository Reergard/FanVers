from django.urls import path
from .views import TopBooksView, TrendsBooksView, UpdateAnalyticsView

app_name = 'analytics_books'

urlpatterns = [
    path('top/', TopBooksView.as_view(), name='top_books'),
    path('trends/', TrendsBooksView.as_view(), name='trends_books'),
    path('update/', UpdateAnalyticsView.as_view(), name='update_analytics'),
]
