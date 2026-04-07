# Додавання розділу (глави) — Backend

Документ описує **реальну** реалізацію ендпоінту створення глави: файли, перевірки, формат запиту та відповіді.

---

## 1. URL та метод

- **URL:** `POST /api/catalog/books/<slug>/add_chapter/`
- **Оголошення:** `backend/apps/catalog/api/urls.py` — `path('books/<slug:slug>/add_chapter/', add_chapter, name='add_chapter')`.
- **View:** функція `add_chapter(request, slug)` у `apps/catalog/api/views.py`.

---

## 2. Декоратори та дозволи

- `@api_view(['POST'])` — дозволений лише метод POST.
- `@parser_classes([MultiPartParser, FormParser])` — тіло запиту обробляється як multipart/form-data (файл + поля форми).
- `@permission_classes([IsAuthenticated, IsBookOwner])` — потрібна авторизація. Клас `IsBookOwner` (у `api/permissions.py`) визначає `has_object_permission(self, request, view, obj)` як `obj.owner == request.user`; для функційної в’юхи об’єкт передається не завжди, тому у самій в’юсі є **явна перевірка власника** після отримання книги.

---

## 3. Логіка у view (покроково)

1. **Книга:** `book = get_object_or_404(Book, slug=slug)`. Якщо книги немає — 404.

2. **Перевірка власника:**  
   `if request.user != book.owner` → `Response({'error': 'У вас немає прав для додавання глав до цієї книги'}, status=403)`.

3. **Поля з запиту:**
   - `volume_id = request.data.get('volume')` — опційно, id тому.
   - `is_paid = request.data.get('is_paid', '').lower() == 'true'`.
   - `title = request.data.get('title')`.

4. **Ціна:**
   - Якщо `is_paid`: з `request.data.get('price', '1.00')` формується `Decimal`; при помилці — `Decimal('1.00')`. Якщо `price <= 0` або `price > 1000` → 400 з текстом «Некоректна ціна розділу».
   - Якщо не платна глава — `price = Decimal('0.00')`.

5. **Файл:**  
   Якщо `'file' not in request.FILES` → 400 з текстом «Файл розділу обов'язковий».

6. **Створення глави:**  
   `Chapter.objects.create(book=book, title=title, file=request.FILES['file'], volume_id=volume_id or None, is_paid=is_paid, price=price)`.

7. **Оновлення книги:**  
   `book.last_updated = timezone.now()`, `book.save(update_fields=['last_updated'])`.

8. **HTML з .docx:**  
   У try/except відкривається `chapter.file.path`, через `mammoth.convert_to_html` генерується HTML, зберігається через `chapter.save_html_content(html_content)`. При винятку лише лог (logger.error), створення глави не відміняється.

9. **Відповідь:**  
   `ChapterSerializer(chapter)` → `Response(serializer.data, status=201)`.

10. **Загальний except:**  
    Будь-який інший виняток → 400 з `{'error': str(e)}`.

---

## 4. Формат запиту (що очікує backend)

- **Content-Type:** multipart/form-data.
- **Поля:**
  - `title` (обов’язковий) — назва розділу.
  - `file` (обов’язковий) — файл .docx у полі файлу.
  - `is_paid` — рядок `"true"` або `"false"`.
  - `volume` — опційно, id тому (число).
  - `price` — рядок числа (використовується при is_paid).

Фронтенд у `catalogApi.uploadChapter` формує саме такий FormData і відправляє на `POST .../add_chapter/`.

---

## 5. Файли

| Файл | Роль |
|------|------|
| `apps/catalog/api/urls.py` | Маршрут `books/<slug:slug>/add_chapter/` → `add_chapter`. |
| `apps/catalog/api/views.py` | Функція `add_chapter`: перевірка власника, читання даних, створення Chapter, генерація HTML, відповідь через ChapterSerializer. |
| `apps/catalog/api/permissions.py` | Клас `IsBookOwner` (has_object_permission); для FBV додатково перевірка власника всередині в’ю. |
| `apps/catalog/models.py` | Модель Chapter (book, title, file, volume, is_paid, price тощо). |

---

## 6. Пов’язана документація

- Frontend-потік: `frontend/src/docs/ADD_CHAPTER_FLOW.md`.
- Доступ до читання глав та навігація: `backend/docs/CHAPTER_ACCESS_BACKEND.md`.
- Підрахунок символів і комісія (що відбувається після `save_html_content`): `backend/docs/CHARACTERS_COUNT_COMMISSION_BACKEND.md`.

**Останнє оновлення:** за поточним коду в проєкті.
