# Доступ к главам и навигация (Backend)

Документ описывает реальную серверную логику доступа к главам и навигации между ними.

---

## 1) Эндпоинты

### Детали главы
- `GET /api/catalog/books/<book_slug>/chapters/<chapter_slug>/`
- Файл: `backend/apps/catalog/api/views.py`
- Функция: `chapter_detail`

### Навигация по главам
- `GET /api/navigation/books/<book_slug>/chapters/<chapter_slug>/navigation/`
- Файл: `backend/apps/navigation/api/views.py`
- Класс: `ChapterNavigationView.get`

### Покупка главы
- `POST /api/users/purchase-chapter/<chapter_id>/`
- Файл: `backend/apps/users/api/balance_views.py`
- См. `SUBSCRIPTION_BACKEND.md` — логіка: prepaid → баланс

---

## 2) Логика доступа в chapter detail

В `chapter_detail` используется такой порядок:

1. Загружается глава (`Chapter` + `book`).
2. Считается `is_owner_or_creator = is_book_owner_or_creator(request.user, chapter.book)`.
3. Если пользователь владелец/создатель книги -> доступ к главе разрешен всегда (включая платные).
4. Если не владелец/создатель:
   - если глава платная и пользователь не авторизован -> `401` (`Необхідна авторизація для перегляду платної глави`);
   - проверяется доступ к книге: `check_book_access_permission(user, book, "download")`;
   - если книга закрыта по правам -> `403` с текстом причины;
   - если глава платная -> проверка покупки: `user_has_chapter_access(request.user, chapter.id)` (UserChapterAccess);
   - если не куплена -> `403` (`Необхідно придбати главу для перегляду`).

После проверок доступа:
- backend отдает HTML главы (`chapter.get_html_content()`), при отсутствии пробует конвертировать docx через `mammoth` и сохранить HTML.

---

## 3) Что вернет chapter detail

Ответ включает:
- `title`
- `content` (HTML)
- `book_title`
- `book` / `book_id`
- `id`
- `book_owner_id`
- `is_paid`
- `price`
- `slug`

Нюанс:
- Поле `book_slug` в ответе этого endpoint сейчас не формируется; фронтенд подставляет slug из URL, если поле отсутствует.

---

## 4) Логика chapter navigation

`ChapterNavigationView`:

1. Находит книгу и текущую главу.
2. Берет все главы книги (`order_by('_position')`).
3. Находит текущий индекс и вычисляет `prev_chapter` / `next_chapter`.
4. Формирует данные каждой главы:
   - `title`, `slug`, `is_paid`, `id`, `volume`.
   - `is_purchased`:
     - если пользователь владелец/создатель книги -> всегда `true`;
     - иначе для авторизованного пользователя -> проверка через `get_user_chapter_access_ids` (UserChapterAccess);
     - для неавторизованного -> `false`.

Это изменение синхронизирует поведение навигации с доступом owner в `chapter_detail`.

---

## 5) Где находится owner-проверка

- `is_book_owner_or_creator(user, book)` — `backend/apps/catalog/api/permissions.py`.
- Условие: `book.owner_id == user.id or book.creator_id == user.id`.

Этот helper используется:
- в `chapter_detail`,
- в `ChapterNavigationView`.

---

## 6) Что важно для frontend

- Источник истины по доступу к платной главе — `chapter_detail`.
- Именно поэтому frontend при переходе Prev/Next сначала делает запрос chapter detail: если сервер отвечает `403`, переход блокируется и показывается сообщение.
- Для owner сервер теперь пропускает всегда, поэтому owner не должен получать `403 "нужно купить"` на свои главы.

