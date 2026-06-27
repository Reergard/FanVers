# Пагінація списку розділів книги (Backend)

Документ описує **серверну** пагінацію таблиці розділів на сторінці книги (`/books/:slug`).  
Це **не** те саме, що кнопка «Показати ще» (`PAGINATION_SHOW_MORE_BACKEND.md`).

---

## 1) Endpoint

| Метод | URL | View |
|-------|-----|------|
| **GET** | `/api/navigation/chapters/paginated/` | `ChapterViewSet.paginated_chapters` |

**Файли:**
- `backend/apps/navigation/api/views.py` — метод `paginated_chapters`
- `backend/apps/navigation/api/urls.py` — `path('chapters/paginated/', ...)`
- `backend/apps/navigation/models.py` — клас `ChapterPagination`

**Query-параметри:**

| Параметр | Обов'язковий | Опис |
|----------|--------------|------|
| `book_id` | так | ID книги |
| `start_chapter` | ні (default `1`) | Порядковий номер **першої** глави в глобальному списку (1-based), після сортування `volume__order`, `order` |

**Відповідь (200):**

```json
{
  "chapters": [ /* ChapterSerializer[] */ ],
  "total_chapters": 500,
  "current_range": { "start": 1, "end": 50 },
  "page_ranges": [
    { "start": 1, "end": 50, "label": "1-50" },
    { "start": 51, "end": 100, "label": "51-100" }
  ]
}
```

**Помилки:** `400` (немає `book_id`), `404` (книга не знайдена).

---

## 2) Логіка `ChapterPagination`

Клас у `backend/apps/navigation/models.py`:

| Усього розділів | Розмір «сторінки» | `page_ranges` |
|-----------------|-------------------|---------------|
| **≤ 50** | усі одразу | `[]` (селектор діапазону не потрібен) |
| **51–999** | **50** | `1-50`, `51-100`, … |
| **1000+** | **100** | `1-100`, `101-200`, … |

Константи в коді: `NO_PAGINATION_LIMIT = 50`, `LARGE_BOOK_THRESHOLD = 1000`, `PAGE_SIZE_DEFAULT = 50`, `PAGE_SIZE_LARGE = 100`.

Методи:
- `get_chapters_per_page(total_chapters)` — розмір однієї «сторінки»
- `get_page_ranges(total_chapters)` — список діапазонів для UI (випадаючий список)

---

## 3) Як обираються глави в діапазоні

```python
chapters = Chapter.objects.filter(book_id=book_id)
    .select_related('volume')
    .order_by('volume__order', 'order')[start_chapter - 1 : end_chapter]
```

- Сортування глобальне (спочатку том, потім `order` у томі).
- `start_chapter` — **індекс у відсортованому списку**, не поле `Chapter.order`.
- Для автентифікованого читача (не власник) підставляються `purchased_chapter_ids` (як у catalog `chapter_list`).

Серіалізатор: `ChapterSerializer` з `apps/catalog/api/serializers.py`.

---

## 4) Catalog endpoint — окремо

| Endpoint | Призначення |
|----------|-------------|
| `GET /api/catalog/books/<slug>/chapters/` | Повний список + `container_versions` + `volumes` |
| `GET /api/navigation/chapters/paginated/` | Сторінка розділів для UI таблиці на сторінці книги |

Повний catalog-список **залишається** і використовується:
- режим **reorder** у власника (frontend завантажує всі розділи + `container_versions` одним запитом);
- інші місця, де потрібен повний масив.

Сторінка книги для перегляду/читання використовує **paginated** endpoint через frontend `BookChapters`.

---

## 5) Пов’язані документи

- Frontend: `frontend/src/docs/CHAPTER_PAGINATION_FRONTEND.md`
- Reorder (повний список): `backend/docs/CHAPTER_REORDER_BACKEND.md`, `frontend/src/docs/CHAPTER_REORDER_FRONTEND.md`
- Навігація між главами (prev/next): `backend/docs/CHAPTER_ACCESS_BACKEND.md`
- «Показати ще» (інша пагінація): `backend/docs/PAGINATION_SHOW_MORE_BACKEND.md`

**Останнє оновлення:** 2026-06-27
