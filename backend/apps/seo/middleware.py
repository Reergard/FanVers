import re

from django.conf import settings
from django.http import HttpResponse
from django.template.loader import render_to_string

from apps.catalog.models import Book
from apps.seo.utils import book_detail_context, catalog_context, home_context

BOT_AGENTS = re.compile(
    r'(googlebot|bingbot|yandex|baiduspider|duckduckbot|'
    r'chatgpt-user|gptbot|claude-web|anthropic-ai|'
    r'google-extended|facebookexternalhit|twitterbot|'
    r'linkedinbot|slackbot|telegrambot|applebot|'
    r'petalbot|semrushbot|ahrefsbot|bytespider|'
    r'perplexitybot|cohere-ai|meta-externalagent)',
    re.IGNORECASE,
)

SEO_ROUTES = [
    (re.compile(r'^/books/(?P<slug>[\w-]+)/?$'), 'book'),
    (re.compile(r'^/catalog/?$'), 'catalog'),
    (re.compile(r'^/?$'), 'home'),
]


class SeoPrerendererMiddleware:
    """
    Для краулерів і AI-ботів віддає повноцінний HTML з мета-тегами та JSON-LD.

    У продакшені nginx має проксувати запити ботів на Django (див. nginx_seo.conf.example).
    sitemap.xml і robots.txt обслуговуються через urls.py незалежно від User-Agent.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not getattr(settings, 'SEO_PRERENDER_ENABLED', True):
            return self.get_response(request)

        ua = request.META.get('HTTP_USER_AGENT', '')
        if not BOT_AGENTS.search(ua):
            return self.get_response(request)

        path = request.path
        for pattern, route_type in SEO_ROUTES:
            match = pattern.match(path)
            if match:
                response = self._render_seo_page(request, route_type, match)
                if response is not None:
                    return response
                break

        return self.get_response(request)

    def _render_seo_page(self, request, route_type, match):
        if route_type == 'book':
            slug = match.group('slug')
            try:
                book = (
                    Book.objects.filter(view_permission='all')
                    .select_related('country')
                    .prefetch_related('genres', 'tags', 'fandoms')
                    .get(slug=slug)
                )
            except Book.DoesNotExist:
                return None
            html = render_to_string(
                'seo/book_detail.html',
                book_detail_context(book, request),
            )
            return HttpResponse(html)

        if route_type == 'catalog':
            books = (
                Book.objects.filter(view_permission='all')
                .order_by('-last_updated')[:50]
            )
            html = render_to_string(
                'seo/catalog.html',
                catalog_context(request, books),
            )
            return HttpResponse(html)

        if route_type == 'home':
            html = render_to_string('seo/home.html', home_context(request))
            return HttpResponse(html)

        return None
