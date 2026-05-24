from django.conf import settings
from django.contrib.sitemaps import Sitemap
from django.http import HttpResponse

from apps.catalog.models import Book
from apps.seo.utils import get_site_url


class BookSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.8
    protocol = 'https'

    def items(self):
        return Book.objects.filter(view_permission='all').order_by('-last_updated')

    def lastmod(self, obj):
        return obj.last_updated

    def location(self, obj):
        return f'/books/{obj.slug}/'


class StaticSitemap(Sitemap):
    changefreq = 'monthly'
    priority = 1.0
    protocol = 'https'

    def items(self):
        return ['/', '/catalog/']

    def location(self, item):
        return item


def robots_txt(request):
    site_url = get_site_url(request)
    lines = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        f'Disallow: /{settings.DJANGO_ADMIN_PATH}/',
        '',
        '# AI Crawlers',
        'User-agent: GPTBot',
        'Allow: /',
        '',
        'User-agent: Google-Extended',
        'Allow: /',
        '',
        'User-agent: ChatGPT-User',
        'Allow: /',
        '',
        'User-agent: anthropic-ai',
        'Allow: /',
        '',
        f'Sitemap: {site_url}/sitemap.xml',
    ]
    return HttpResponse('\n'.join(lines), content_type='text/plain')
