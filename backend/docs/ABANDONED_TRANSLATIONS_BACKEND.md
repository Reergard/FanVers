# Покинуті переклади — Backend

Документ описує **реальну** серверну реалізацію endpoint для списку покинутих перекладів.

---

## 1) URL і підключення

- Кореневий префікс API: `backend/FanVers_project/urls.py` -> `path('api/', include('apps.api.urls'))`
- Підключення каталогу: `backend/apps/api/urls.py` -> `path('catalog/', include('apps.catalog.api.urls'))`
- Маршрут endpoint: `backend/apps/catalog/api/urls.py` -> `path('abandoned-translations/', abandoned_translations, name='abandoned-translations')`

Підсумковий URL:

- `GET /api/catalog/abandoned-translations/`

---

## 2) View і логіка вибірки

Файл: `backend/apps/catalog/api/views.py`  
Функція: `abandoned_translations(request)`

Що робить:

1. Фільтрує книги: `Book.objects.filter(translation_status='ABANDONED')`
2. Оптимізує запит:
   - `select_related('owner', 'creator')`
   - `prefetch_related('genres', 'tags', 'fandoms', 'country')`
3. Серіалізує через `BookReaderSerializer(..., many=True, context={'request': request})`
4. Повертає `200 OK` зі списком книг.

Обробка помилок:

- Будь-який виняток -> `500` з `{ "error": "Внутрішня помилка сервера" }`

---

## 3) Права доступу

На цій view **немає** `@permission_classes(...)`.

Тому застосовується глобальне значення DRF:

- `backend/FanVers_project/settings.py` -> `REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES'] = ['rest_framework.permissions.AllowAny']`

Наслідок:

- endpoint доступний для анонімних і авторизованих користувачів.

---

## 4) Формат даних відповіді

Серіалізатор: `backend/apps/catalog/api/serializers.py` -> `BookReaderSerializer`

Ключові поля, які реально повертаються і використовуються фронтендом сторінки:

- `id`, `slug`, `title`, `image`, `adult_content`, `book_type`
- `translation_status`, `translation_status_display`
- `original_status`, `original_status_display`
- `genres`, `tags`, `fandoms` (масиви об’єктів `{ id, name, ... }`)
- `last_updated`
- `created_at` (додано в serializer для сортування на фронті)

Нотатка:

- `bookmark_status` та `bookmark_id` для анонімного користувача повертаються `null` (бо всередині serializer перевіряється `request.user.is_authenticated`).

---

## 5) Модельні умови

Файл: `backend/apps/catalog/models.py`  
Модель: `Book`

Поле, яке визначає потрапляння книги у список покинутих:

- `translation_status` (choices містить `ABANDONED`)

Тобто у цей endpoint потрапляють книги з `translation_status = 'ABANDONED'`.

---

## 6) Пов’язані backend-файли

| Файл | Роль |
|------|------|
| `backend/apps/catalog/api/urls.py` | Маршрут `abandoned-translations/` |
| `backend/apps/catalog/api/views.py` | Функція `abandoned_translations` |
| `backend/apps/catalog/api/serializers.py` | `BookReaderSerializer` (payload) |
| `backend/apps/catalog/models.py` | `Book.translation_status` |
| `backend/FanVers_project/settings.py` | Default permission (`AllowAny`) |

---

## 7) Пов’язані frontend-файли

- `frontend/src/api/catalogApi.ts` -> `getAbandonedTranslations()`
- `frontend/src/catalog/AbandonedTranslations.tsx`
- `frontend/src/docs/ABANDONED_TRANSLATIONS_FRONTEND.md`
