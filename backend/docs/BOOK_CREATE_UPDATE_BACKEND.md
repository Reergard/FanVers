# Створення та оновлення книги — Backend

Документ описує **реальну** реалізацію ендпоінтів створення та оновлення книги: файли, валідацію, формат запиту та відповіді.

---

## 1. URL та методи

| Операція | URL | Метод | Оголошення (urls.py) |
|----------|-----|-------|----------------------|
| Створення | `/api/catalog/books/create/` | POST | `path('books/create/', create_book, name='book-create')` |
| Оновлення | `/api/catalog/books/<slug>/update/` | PUT | `path('books/<slug:slug>/update/', update_book, name='book-update')` |

---

## 2. Декоратори та дозволи

### create_book

- `@api_view(['POST'])` — дозволений лише POST.
- `@parser_classes([MultiPartParser, FormParser])` — явно multipart/form-data (як у `update_book`).
- `@permission_classes([IsAuthenticated])` — потрібна авторизація.

### update_book

- `@api_view(['PUT'])` — дозволений лише PUT.
- `@parser_classes([MultiPartParser, FormParser])` — тіло обробляється як multipart/form-data.
- `@permission_classes([IsAuthenticated])` — потрібна авторизація.
- **Перевірка власника:** у view перевіряється `book.owner == request.user`. Якщо ні — 403 з текстом «У вас немає прав для редагування цієї книги».

---

## 3. Обробка FormData (create та update)

DRF може некоректно обробляти QueryDict для ManyToMany при FormData, тому в обох view використовується явна обробка:

1. Для ключів `genres`, `tags`, `fandoms` викликається `request.data.getlist(key)`.
2. Рядкові значення конвертуються в int, якщо можливо.
3. Інші поля беруться через `request.data.get(key)`.
4. Утворюється dict `processed_data` для передачі в сериалізатор.

---

## 4. BookCreateSerializer

**Файл:** `apps/catalog/api/serializers.py`

### Поля

- `title`, `title_en`, `author`, `description`, `image`
- `translation_status`, `original_status`, `country`
- `genres`, `tags`, `fandoms` — PrimaryKeyRelatedField, many=True
- `adult_content`, `book_type`
- `view_permission`, `comment_book_permission` та інші (у fields, але форма їх не відправляє)

### Валідація (validate)

- **book_type = AUTHOR:** `translation_status` встановлюється в `None`.
- **book_type = TRANSLATION:** якщо `translation_status` пустий — `'TRANSLATING'`.
- Обов'язкові поля: title, author, country, genres, original_status.
- Для TRANSLATION — обов'язковий translation_status.
- **Тільки при створенні** (`self.instance is None`): заборонені статуси `['Перерва', 'Закінчено', 'Зупинено', 'ABANDONED', 'COMPLETED', 'STOPPED']`. При оновленні ці статуси дозволені.
- Мінімум 2 символи для title.
- Мінімум 10 символів для description (якщо передано).
- Максимум **900** символів для description (якщо передано); помилка: «Опис не може перевищувати 900 символів».
- Максимум 5 жанрів, 10 тегів.

### create()

- Видаляє genres, tags, fandoms з validated_data.
- Створює Book через `Book.objects.create(**validated_data)`.
- Встановлює M2M: `book.genres.set()`, `book.tags.set()`, `book.fandoms.set()`.
- Викликається з `owner=request.user`, `creator=request.user`.

### update()

- Видаляє genres, tags, fandoms (якщо є).
- Оновлює скалярні поля через `setattr`.
- Зберігає instance.
- Якщо genres/tags/fandoms у validated_data — викликає `.set()`.

---

## 5. Логіка create_book

1. Обробка FormData (getlist для M2M).
2. `BookCreateSerializer(data=data)`.
3. Якщо валідно: `serializer.save(owner=request.user, creator=request.user)`.
4. Відповідь: `BookOwnerSerializer(book)` → 201 Created.
5. Помилка валідації: 400 з `{ error, details, message }`.
6. Інший exception: 500 з `{ error: 'Внутрішня помилка сервера: ' + str(e) }`.

---

## 6. Логіка update_book

1. `book = get_object_or_404(Book, slug=slug)` — 404, якщо книги немає.
2. Перевірка: `book.owner != request.user` → 403.
3. Обробка FormData (getlist для M2M).
4. `BookCreateSerializer(instance=book, data=data, partial=True)`.
5. Якщо валідно: `serializer.save()`.
6. Відповідь: `BookOwnerSerializer(book)` → 200 OK.
7. Помилка валідації: 400 з `{ error, details, message }`.
8. Інший exception: 500 з `{ error: 'Внутрішня помилка сервера: ' + str(e) }`.

---

## 7. Формат запиту (що очікує backend)

**Content-Type:** multipart/form-data.

**Поля (обов'язкові позначені *):**

| Поле | Обов'язкове | Примітка |
|------|-------------|----------|
| title | так | мін. 2 символи |
| author | так | |
| country | так | id країни |
| genres | так | мін. 1, макс. 5; кілька `genres=N` |
| original_status | так | ONGOING / STOPPED / COMPLETED |
| book_type | так | AUTHOR / TRANSLATION |
| translation_status | для TRANSLATION | TRANSLATING / WAITING / PAUSED / ABANDONED |
| description | ні | мін. 10, макс. **900** символів, якщо передано |
| title_en | ні | |
| tags | ні | макс. 10; кілька `tags=N` |
| fandoms | ні | кілька `fandoms=N` |
| adult_content | так | "true" / "false" |
| image | ні | File |

---

## 8. Ліміти опису книги (збереження vs відображення)

| Контекст | Ліміт | Примітка |
|----------|-------|----------|
| `BookCreateSerializer` (create/update) | **900** символів | Валідація в `validate()`; у моделі `Book.description` — `TextField` без `max_length` |
| Форма на фронті | **900** | `DESCRIPTION_MAX_CHARS` у `bookForm.utils.ts` |
| SEO snippet (`get_seo_snippet`) | **120** | Перші символи чистого тексту для meta description |
| Каруселі головної (фронт) | **500** | Лише UI-обрізка; API повертає повний опис |

Зміна ліміту збереження не вимагає міграції БД — достатньо оновити сериалізатор і константу на фронті.

---

## 9. Файли

| Файл | Роль |
|------|------|
| `apps/catalog/api/urls.py` | Маршрути `books/create/`, `books/<slug>/update/` |
| `apps/catalog/api/views.py` | `create_book`, `update_book` |
| `apps/catalog/api/serializers.py` | `BookCreateSerializer` (validate, create, update) |
| `apps/catalog/models.py` | Модель Book |

---

**Останнє оновлення:** 2026-06-24 — ліміт опису **900** символів (раніше 300 на фронті).
