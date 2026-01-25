from rest_framework.routers import DefaultRouter
from .views import BookRatingViewSet


# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'', BookRatingViewSet, basename='rating')


app_name = 'rating'


urlpatterns = router.urls

# api/rating/book/<slug:book_slug>/rating/