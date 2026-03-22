# Пагінація для "Показати ще" (Backend)

Документ описує тільки те, що є в поточному backend-коді для сторінок, де frontend показує кнопку `Показати ще`.

---

## 1) Ключовий факт

Для списків, що зараз відображаються через `ShowMoreNavigation` на фронтенді, бекенд **не виконує сторінкову пагінацію**.

Тобто API віддає повний масив, а дозавантаження робиться тільки на frontend через `slice(...)`.

---

## 2) Чому це так (по коду)

### DRF settings

`backend/FanVers_project/settings.py`:

- `REST_FRAMEWORK` містить authentication/permission/throttle;
- `DEFAULT_PAGINATION_CLASS` і `PAGE_SIZE` не задані.

### View-код

У відповідних `list`/function views немає викликів:

- `paginate_queryset(...)`,
- `self.paginator`,
- `PageNumberPagination` / `LimitOffsetPagination`.

Відповідь формується як `serializer(queryset, many=True)` і повертається цілком.

---

## 3) Endpoint-и, які віддають повні списки

### Catalog

- `GET /api/catalog/books/reader/`
  - файл: `backend/apps/catalog/api/views.py`
  - клас: `BookReaderViewSet.list`
  - повертає весь `Book.objects.all().order_by('-last_updated')`.

- `GET /api/catalog/abandoned-translations/`
  - файл: `backend/apps/catalog/api/views.py`
  - функція: `abandoned_translations`
  - повертає всі книги з `translation_status='ABANDONED'`.
  - як формується статус і фонові перевірки — **ABANDONED_TRANSLATIONS_BACKEND.md**.

- `GET /api/catalog/user-translations/`
  - файл: `backend/apps/catalog/api/views.py`
  - функція: `user_translations`
  - повертає всі книги поточного користувача (з owner=request.user) зі статистикою.

### Users

- `GET /api/users/authors/`
  - файл: `backend/apps/users/api/views.py`
  - функція: `get_authors_list`
  - повертає весь сформований список авторів.

- `GET /api/users/translators/`
  - файл: `backend/apps/users/api/views.py`
  - функція: `get_translators_list`
  - повертає весь сформований список перекладачів.

### Navigation / Bookmarks

- `GET /api/navigation/bookmarks/`
  - файл: `backend/apps/navigation/api/views.py`
  - клас: `BookmarkViewSet.list`
  - підтримує фільтр `?status=...`, але не пагінацію.

### Notification

- `GET /api/notification/notifications/`
  - файл: `backend/apps/notification/api/views.py`
  - клас: `NotificationViewSet.list`
  - використовує `version` для "є зміни / немає змін", але не сторінкову пагінацію.

---

## 4) Що відбувається після натискання "Показати ще"

Після кліку frontend:

- **не відправляє додатковий запит** на ці endpoint-и;
- не передає `page`, `limit`, `offset`;
- просто збільшує локальний лічильник і показує більше елементів з уже отриманого масиву.

Тому для цієї кнопки backend у момент кліку не виконує нової бізнес-логіки.

---

## 5) Що є схожого, але не використовується цією кнопкою

У проекті є окремий endpoint для пагінації глав:

- `ChapterViewSet.paginated_chapters` у `backend/apps/navigation/api/views.py`.

Він працює для глав книги (`book_id`, `start_chapter`) і не використовується сторінками з `ShowMoreNavigation`.

---

## 6) Висновок

Для поточної реалізації кнопки `Показати ще`:

- backend відповідає за повний список даних і базову фільтрацію/сортування в endpoint-ах;
- frontend відповідає за "скільки елементів показати зараз" і за клік по кнопці.
