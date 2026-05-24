from django.contrib.sitemaps.views import sitemap
from django.urls import path

from .views import BookSitemap, StaticSitemap, robots_txt

sitemaps = {
    'books': BookSitemap,
    'static': StaticSitemap,
}

urlpatterns = [
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='sitemap'),
    path('robots.txt', robots_txt, name='robots_txt'),
]
