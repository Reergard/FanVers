# Коментарі (Backend)

Документ описує, як реалізовані коментарі до книг і глав на бекенді: які файли залучені, яка логіка, перевірки та особливості.

---

## 1. Огляд

Є два типи коментарів:

- **Коментарі до книги** — прив’язані до книги за `book.slug`.
- **Коментарі до глави** — прив’язані до глави за `chapter.slug`.

Підтримуються:

- Дерево коментарів (кореневі + відповіді через `parent`).
- Лайк/дизлайк (M2M `likes`, `dislikes`).
- «Лайк автора» — тільки власник книги може поставити один лайк на коментар (`owner_like`).
- Створення коментаря/відповіді — з перевіркою прав доступу до книги (`check_book_access_permission`).
- Видалення — тільки автор коментаря (`perform_destroy`).

---

## 2. Файли та їх ролі

| Файл | Призначення |
|------|-------------|
| **apps/reviews/models.py** | Моделі `BaseComment` (abstract), `BookComment`, `ChapterComment`: user, text, parent, created_at, likes, dislikes, owner_like. Методи `get_likes_count`, `get_dislikes_count`, `has_owner_like`. |
| **apps/reviews/api/serializers.py** | `UserSerializer` (id, username, profile_image), `BaseCommentSerializer` (валідація text 3–1000 символів, likes_count, dislikes_count, user_reaction, has_owner_like, owner_like_type), `BookCommentSerializer` / `ChapterCommentSerializer` (replies рекурсивно). |
| **apps/reviews/api/views.py** | `BookCommentViewSet`, `ChapterCommentViewSet` (list/create/destroy), `LikeDislikeViewSet` (update_reaction, owner_like). |
| **apps/reviews/api/urls.py** | Роутер: book/<slug>/comments, chapter/<slug>/comments, book-comment, chapter-comment. |
| **apps/api/urls.py** | Підключення: `path('reviews/', include('apps.reviews.api.urls'))`. |
| **apps/catalog/api/permissions.py** | `check_book_access_permission(user, book, 'comment_book' | 'comment_chapter')` — використовується при створенні коментаря. |

---

## 3. Маршрути (URL)

Префікс: `/api/reviews/` (через `apps/api/urls.py`).

| Дія | URL | Метод | ViewSet / action |
|-----|-----|--------|-------------------|
| Список коментарів книги | `/api/reviews/book/<slug>/comments/` | GET | BookCommentViewSet.list |
| Створити коментар/відповідь книги | `/api/reviews/book/<slug>/comments/` | POST | BookCommentViewSet.create |
| Видалити коментар книги | `/api/reviews/book/<slug>/comments/<pk>/` | DELETE | BookCommentViewSet.destroy |
| Список коментарів глави | `/api/reviews/chapter/<slug>/comments/` | GET | ChapterCommentViewSet.list |
| Створити коментар/відповідь глави | `/api/reviews/chapter/<slug>/comments/` | POST | ChapterCommentViewSet.create |
| Видалити коментар глави | `/api/reviews/chapter/<slug>/comments/<pk>/` | DELETE | ChapterCommentViewSet.destroy |
| Лайк/дизлайк (книга) | `/api/reviews/book-comment/<pk>/update_reaction/` | POST | LikeDislikeViewSet.update_reaction |
| Лайк автора (книга) | `/api/reviews/book-comment/<pk>/owner_like/` | POST | LikeDislikeViewSet.owner_like |
| Лайк/дизлайк (глава) | `/api/reviews/chapter-comment/<pk>/update_reaction/` | POST | LikeDislikeViewSet.update_reaction |
| Лайк автора (глава) | `/api/reviews/chapter-comment/<pk>/owner_like/` | POST | LikeDislikeViewSet.owner_like |

Роутери в `urls.py`: `book-comment` і `chapter-comment` — це окремі ViewSet без slug у шляху (тільки `pk`).

---

## 4. get_queryset і list/destroy

- **list:** повертаються тільки **кореневі** коментарі: `filter(book=book, parent=None)` (книга) або `filter(chapter=chapter, parent=None)` (глава). Відповіді приходять у полі `replies` сериалізатора (рекурсивно).
- **retrieve / update / destroy:** queryset — **усі** коментарі книги/глави: `filter(book=book)` або `filter(chapter=chapter)`. Тому можна видалити й кореневий коментар, і відповідь (по `pk`).

У `views.py` це реалізовано так:

```python
if self.action == 'list':
    return BookComment.objects.filter(book=book, parent=None)
return BookComment.objects.filter(book=book)
```

Аналогічно для `ChapterCommentViewSet`.

---

## 5. Створення коментаря (create)

1. Отримання книги/глави за `slug` з URL.
2. Перевірка прав: `check_book_access_permission(request.user, book, 'comment_book')` або `'comment_chapter'`. При забороні — 403 з `error_message`.
3. Перевірка авторизації: якщо не `request.user.is_authenticated` — 401.
4. Валідація даних сериалізатором: `text` (trim, довжина 3–1000), опційно `parent` (id батьківського коментаря). При помилках — 400.
5. `perform_create`: у `validated_data` підставляються `user` і `book`/`chapter`; збереження в БД.
6. Відповідь — 201 і тіло створеного коментаря (сериалізатор).

Тіло запиту: `{ "text": "...", "parent": null | id }`. Для відповіді передається `parent` з id коментаря, на який відповідають.

---

## 6. Видалення (destroy)

1. `get_object()` — коментар береться з queryset (усі коментарі книги/глави), тому знаходиться і кореневий, і відповідь.
2. `perform_destroy(instance)`:
   - перевірка: `request.user != instance.user` → `PermissionDenied("Можна видаляти лише свої коментарі.")` (403);
   - інакше — `instance.delete()`.

Тобто видаляти може лише автор коментаря.

---

## 7. Лайк/дизлайк (update_reaction)

- **URL:** `POST /api/reviews/book-comment/<pk>/update_reaction/` або `chapter-comment/<pk>/update_reaction/`.
- **Тіло:** `{ "action": "like" | "dislike" }`.
- Логіка:
  - Коментар знаходиться по `pk` (BookComment або ChapterComment залежно від basename).
  - Користувач має бути авторизований (інакше 401).
  - Якщо `action == 'like'`: користувач додається в `likes`, прибирається з `dislikes`; якщо вже в likes — прибирається (toggle).
  - Якщо `action == 'dislike'`: аналогічно для `dislikes` і `likes`.
  - Інші значення `action` — 400.
- Відповідь — 200 і повний об’єкт коментаря (сериалізатор), щоб клієнт міг оновити лічильники та `user_reaction`.

---

## 8. Лайк автора (owner_like)

- **URL:** `POST /api/reviews/book-comment/<pk>/owner_like/` або `chapter-comment/<pk>/owner_like/`.
- Перевірка: `request.user` має бути **власником книги** (`book.owner`). Інакше — 403: «Тільки власник книги може ставити цей лайк».
- Логіка: якщо в коментаря вже стоїть `owner_like == request.user`, то `owner_like` скидається в `None`, інакше встановлюється `request.user`. Потім `comment.save()`.
- Відповідь — 200 і об’єкт коментаря.

---

## 9. Валідація тексту (серіалізатор)

У `BaseCommentSerializer.validate_text`:

- Порожній або лише пробіли → ValidationError.
- Після trim: довжина < 3 → ValidationError, > 1000 → ValidationError.
- Повертається `value.strip()`.

Повідомлення помилок у валідації — текстові рядки у відповіді 400.

---

## 10. Формат відповіді (list)

- Якщо коментарів немає: `list()` повертає `Response({'detail': 'Коментарів поки немає.'}, status=200)` — тіло не масив.
- Якщо є коментарі: повертається масив об’єктів сериалізатора.

Поля коментаря в API: `id`, `book`|`chapter`, `user` (id, username, profile_image), `text`, `parent`, `created_at`, `likes_count`, `dislikes_count`, `user_reaction` ('like'|'dislike'|null), `replies` (рекурсивно), `has_owner_like`, `owner_like_type`.

---

## 11. Моделі (коротко)

- **BaseComment (abstract):** user (FK), text, parent (FK self, null), created_at, likes (M2M), dislikes (M2M), owner_like (FK User, null). Методи: `get_likes_count`, `get_dislikes_count`, `has_owner_like`.
- **BookComment:** + book (FK).
- **ChapterComment:** + chapter (FK).

Cascade: при видаленні книги/глави/користувача відповідні коментарі видаляються через on_delete=CASCADE.

---

**Останнє оновлення:** відповідно до поточного коду в apps/reviews/.
