import json
from typing import Any

from django.conf import settings
from django.utils.safestring import mark_safe

from apps.seo.constants import SEO_SITE_NAME


def _json_ld_dump(data: dict) -> str:
    """Серіалізує dict у JSON-рядок, безпечний для вставки в <script type='application/ld+json'>.

    1. json.dumps — створює валідний JSON.
    2. Замінює «</» на «<\\/» — запобігає XSS через закриття <script> тегу
       (якщо title/description містить «</script>»).
    3. mark_safe — вимикає Django-автоекранування, щоб {{ var }} у шаблоні
       НЕ перетворювало " на &quot; (інакше JSON зламаний).
    """
    raw = json.dumps(data, ensure_ascii=False)
    raw = raw.replace('</', '<\\/')
    return mark_safe(raw)


def get_site_url(request=None) -> str:
    base = getattr(settings, 'SEO_SITE_URL', None) or getattr(settings, 'FRONTEND_URL', 'https://fan-vers.com')
    return base.rstrip('/')


def absolute_media_url(request, file_field) -> str | None:
    if not file_field:
        return None
    if request is not None:
        return request.build_absolute_uri(file_field.url)
    return f"{get_site_url()}{file_field.url}"


def build_book_json_ld(book, request=None) -> dict[str, Any]:
    site_url = get_site_url(request)
    book_url = f'{site_url}/books/{book.slug}/'
    data: dict[str, Any] = {
        '@context': 'https://schema.org',
        '@type': 'Book',
        'name': book.title,
        'author': {
            '@type': 'Person',
            'name': book.author or 'Невідомий автор',
        },
        'url': book_url,
        'description': book.get_seo_meta_description(),
        'inLanguage': 'uk',
        'genre': [g.name for g in book.genres.all()],
        'publisher': {
            '@type': 'Organization',
            'name': 'FanVers',
            'url': site_url,
        },
        'isAccessibleForFree': True,
        'numberOfPages': book.chapters_count,
    }
    if book.title_en:
        data['alternateName'] = book.title_en
    image_url = absolute_media_url(request, book.image)
    if image_url:
        data['image'] = image_url
    if book.created_at:
        data['datePublished'] = book.created_at.strftime('%Y-%m-%d')
    if book.last_updated:
        data['dateModified'] = book.last_updated.strftime('%Y-%m-%d')
    return data


def build_website_json_ld(request=None) -> dict[str, Any]:
    site_url = get_site_url(request)
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': 'FanVers',
        'url': site_url,
        'description': SEO_SITE_NAME,
        'inLanguage': 'uk',
        'potentialAction': {
            '@type': 'SearchAction',
            'target': f'{site_url}/search?q={{search_term_string}}',
            'query-input': 'required name=search_term_string',
        },
    }


def book_detail_context(book, request) -> dict[str, Any]:
    site_url = get_site_url(request)
    book_url = f'{site_url}/books/{book.slug}/'
    return {
        'book': book,
        'request': request,
        'site_url': site_url,
        'book_url': book_url,
        'seo_title': book.get_seo_title(),
        'seo_meta_description': book.get_seo_meta_description(),
        'seo_keywords': book.get_seo_keywords(),
        'cover_alt': book.get_cover_alt(),
        'book_json_ld': _json_ld_dump(build_book_json_ld(book, request)),
        'website_json_ld': _json_ld_dump(build_website_json_ld(request)),
        'og_image': absolute_media_url(request, book.image),
    }


def catalog_context(request, books) -> dict[str, Any]:
    site_url = get_site_url(request)
    from apps.seo.constants import SEO_CATALOG_DESCRIPTION, SEO_CATALOG_TITLE

    return {
        'request': request,
        'site_url': site_url,
        'catalog_url': f'{site_url}/catalog/',
        'seo_title': SEO_CATALOG_TITLE,
        'seo_meta_description': SEO_CATALOG_DESCRIPTION,
        'books': books,
        'website_json_ld': _json_ld_dump(build_website_json_ld(request)),
    }


def home_context(request) -> dict[str, Any]:
    site_url = get_site_url(request)
    from apps.seo.constants import SEO_HOME_DESCRIPTION, SEO_HOME_TITLE

    return {
        'request': request,
        'site_url': site_url,
        'seo_title': SEO_HOME_TITLE,
        'seo_meta_description': SEO_HOME_DESCRIPTION,
        'website_json_ld': _json_ld_dump(build_website_json_ld(request)),
    }
