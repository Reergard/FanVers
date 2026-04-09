# Пошук книг — Backend

Документ описує реальну backend-реалізацію endpoint пошуку книг.

---

## 1) URL і підключення

- `backend/apps/api/urls.py`:
  - `path('search/', include('apps.search.api.urls'))`
- `backend/apps/search/api/urls.py`:
  - `path('book-search/', BookSearchView.as_view(), name='book-search')`

Підсумковий URL:

- `GET /api/search/book-search/`

---

## 2) View і базова логіка

Файл: `backend/apps/search/api/views.py`  
Клас: `BookSearchView(generics.ListAPIView)`

Що робить:

1. Формує queryset: `Book.objects.annotate(chapter_count=Count('chapters'))`
2. Застосовує фільтри через `self.filter_queryset(queryset)`
3. Віддає список через `BookReaderSerializer`

Фільтрація підключена через:

- `filter_backends = [DjangoFilterBackend]`
- `filterset_class = BookFilter`

---

## 3) Які параметри реально підтримує backend

Файл: `backend/apps/search/filters.py` (клас `BookFilter`)

Підтримуються:

- `title` (шукає по `title` і `title_en`)
- `genres`
- `countries`
- `min_chapters`
- `max_chapters`
- `tags`
- `fandoms`
- `exclude_genres`
- `exclude_fandoms`
- `exclude_tags`
- `order`
- `adult_content`

---

## 4) Важливі деталі реалізації фільтрів

- `adult_content=true` -> повертає всі книги.
- `adult_content=false` -> додає `queryset.filter(adult_content=False)`.
- `title` реалізований через:
  - `Q(title__icontains=value) | Q(title_en__icontains=value)`
- `min_chapters` / `max_chapters` працюють по анотованому полю `chapter_count`.

### Server-side enforcement (adult content)

У `get_queryset()` **до** фільтрації застосовується серверна логіка:

- **Анонімний користувач** → завжди `queryset.filter(adult_content=False)`.
- **Авторизований з `profile.hide_adult_content=True`** → те саме.
- **Помилка доступу до профілю** → fail-closed: `queryset.filter(adult_content=False)`.

Це означає, що навіть з `adult_content=true` у query-параметрі, сервер відфільтрує дорослий контент для анонімів і користувачів з увімкненим прихованням.

Додатково у відповіді serializer повертає:

- `bookmark_status`
- `bookmark_id`

Ці поля заповнюються для авторизованого користувача (визначаються відносно `request.user`), для гостя повертаються `null`.

---

## 5) Що backend не підтримує у цьому endpoint

У `BookFilter` відсутні параметри:

- `viewedOnly`
- `hideBookmarks`

Тобто ці два прапорці не можуть впливати на результат через query-параметри endpoint.

При цьому `hideBookmarks` може реалізовуватися на фронті без зміни цього endpoint — через already-returned `bookmark_status`.

---

## 6) Пов’язані frontend-файли

- `frontend/src/api/searchApi.ts` — відправляє параметри
- `frontend/src/search/search.tsx` — формує стани пошуку і викликає API
- `frontend/src/navigation/FilterDropdown.tsx` — UI dropdown фільтрів на сторінці пошуку
- `frontend/src/docs/SEARCH_FRONTEND.md` — детальна фронтенд-документація

