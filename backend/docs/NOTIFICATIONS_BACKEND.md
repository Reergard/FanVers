# Система повідомлень (бекенд)

Коротко: збережені **внутрішні повідомлення** користувача (модель `Notification`) віддаються через **REST** під префіксом `/api/notification/`. Список підтримує **оптимізацію за версією** (`?version=`), щоб не повторно віддавати той самий набір. Створення записів відбувається **сигналами** та **Celery-задачами**; клієнт може також викликати `POST` на той самий ViewSet (для поточного користувача).

Деталі UI та React Query — у **`frontend/src/docs/NOTIFICATIONS_FRONTEND.md`**.

---

## 1. Маршрути та файли

| Що | Де |
|----|-----|
| Підключення в проєкт | `apps/api/urls.py` → `path('notification/', include('apps.notification.api.urls'))` |
| Маршрути застосунку | `apps/notification/api/urls.py` — `DefaultRouter`, ресурс `notifications` |
| ViewSet | `apps/notification/api/views.py` — `NotificationViewSet` |
| Права на об'єкт | `apps/notification/api/permissions.py` — `IsNotificationOwner` (`obj.user_id == request.user.id`) |
| Серіалізатор | `apps/notification/api/serializers.py` — `NotificationSerializer` |
| Модель | `apps/notification/models.py` — `Notification` |
| Події → записи | `apps/notification/signals.py` |
| Покинуті переклади | `apps/notification/tasks.py` (див. також `ABANDONED_TRANSLATIONS_BACKEND.md`) |

**Базові URL (DRF router):**

| Метод | Шлях | Дія |
|--------|------|-----|
| GET | `/api/notification/notifications/` | Список (з логікою `version`) |
| POST | `/api/notification/notifications/` | Створення для `request.user` |
| GET | `/api/notification/notifications/<id>/` | Один запис (retrieve) |
| PATCH | `/api/notification/notifications/<id>/mark_as_read/` | Позначити прочитаним |
| DELETE | `/api/notification/notifications/<id>/` | Видалити |

---

## 2. Авторизація та доступ

У `FanVers_project/settings.py` для DRF задано `DEFAULT_PERMISSION_CLASSES = [AllowAny]`, тому **явні** обмеження на ViewSet обов’язкові для приватних даних.

`NotificationViewSet`:

- `permission_classes = [IsAuthenticated, IsNotificationOwner]`
- `authentication_classes = [JWTAuthentication]`

`IsNotificationOwner` застосовується до **об’єктних** дій (`retrieve`, `update`, `partial_update`, `destroy`, кастомний `mark_as_read`): доступ лише до сповіщень поточного користувача. Для **`list`** / **`create`** достатньо автентифікації та фільтрації queryset по `request.user`.

Без валідного JWT запити до цих endpoint-ів не обслуговуються як автентифіковані користувачі (очікуйте 401).

**Примітка:** у `DEBUG` глобально до аутентифікації додається `SessionAuthentication`; на цьому ViewSet указано лише JWT — узгоджено з іншими закритими API (чат, баланс, підтримка). Тестування з браузера DRF лише по сесії без JWT може не спрацювати.

---

## 3. `get_queryset`

- Фільтр: `Notification.objects.filter(user=request.user)`.
- `select_related('book', 'error_report', 'error_report__user', 'error_report__chapter')` — зменшує кількість запитів при серіалізації.
- Сортування: `order_by('-created_at')`.
- При винятку в блоці — повертається порожній queryset.

---

## 4. `list` і параметр `version`

Поведінка **не** є сторінковою пагінацією: завжди формується повний queryset користувача, але відповідь може бути скорочена.

1. Читається `version` з query (`request.query_params.get('version', '0')`), парситься в int (помилка парсингу → `0`).
2. **`new_version`**:
   - якщо є хоча б одне повідомлення: `int(найновішого.created_at.timestamp() * 1000)` (мілісекунди Unix time найсвіжішого за `order_by('-created_at')`);
   - якщо списку немає: `int(time.time() * 1000)` (поточний час — версія змінюється майже щоразу).
3. Якщо `current_version_int == new_version` — повертається **`{ "notifications": [], "version": new_version }`** (сигнал «дані ті самі»).
4. Інакше — повний список: **`{ "notifications": serializer.data, "version": new_version }`**.

Транзакція **`@transaction.atomic`** на `list` **не** використовується (лише читання).

**Наслідок для клієнта:** порожній масив при **збігу версій** означає «без змін», а не «нуль повідомлень». На фронті merge спрацьовує за умовою «порожній масив у відповіді + у кеші вже був список» (див. `useNotifications.ts`); явного порівняння `version` у цьому merge немає — покладаються на цю відповідь бекенда.

---

## 5. Інші дії ViewSet

### `mark_as_read` (PATCH, detail)

- `get_object()` у межах queryset користувача.
- Додаткова перевірка `notification.user == request.user` → інакше 403.
- `is_read = True`, `save(update_fields=['is_read'])`.
- Відповідь: серіалізований об’єкт одного повідомлення.

### `destroy` (DELETE)

- Перевірка власника; `transaction.atomic` на методі.
- Успіх: **204 No Content**.

### `create` (POST)

- `transaction.atomic`.
- Створюється запис з `user=request.user`, поля з тіла: `message`, `book`, `is_read` (за замовчуванням `False`).
- Відповідь: **201** + серіалізовані дані.

---

## 6. `NotificationSerializer`

Поля: `id`, `message`, `created_at`, `is_read`, `book` (вкладений `BookReaderSerializer`, може бути `null`), `error_report_id`, `reporter_username`, `book_title`, `chapter_title`, `error_text`, `suggestion`.

Обчислювані поля для репортів беруться з `error_report` (користувач, розділ, текст, suggestion). У `to_representation` для записів без книги/репорту зайві поля обнуляються.

Репорти помилок у тексті та цей серіалізатор — у **`BOOK_ERROR_REPORT_BACKEND.md`**.

---

## 7. Модель `Notification`

- Зв’язки: `user`, `book` (nullable), `error_report` (nullable).
- `UniqueConstraint(fields=['user', 'error_report'], name='unique_user_error_report')` — один репорт на пару користувач + репорт (для `error_report=NULL` у PostgreSQL кілька рядків на одного користувача допустимі).
- Індекси: `user` + `-created_at`, `error_report`.

---

## 8. Сигнали (`signals.py`)

| Подія | Отримувач | Примітка |
|--------|-----------|----------|
| Новий `Chapter` | Користувачі з **закладкою** на книгу | Один **`bulk_create`** по списку `Notification`, `select_related('user')` на закладках |
| Новий `BookComment` | Власник книги | `Notification.objects.create` |
| Новий `ChapterComment` | Власник книги | `Notification.objects.create` |
| Новий `ErrorReport` | Власник книги | `create` з `error_report=instance` |

---

## 9. Celery (`tasks.py`)

Задачі для сценарію **покинутих перекладів** створюють `Notification` для власника книги (попередження та факт переносу). Детальний опис порогів і ідемпотентності — **`ABANDONED_TRANSLATIONS_BACKEND.md`**.

---

## 10. Зв’язок із іншою документацією

- Пагінація «Показати ще» на фронті — локальна поверх повного списку з `GET .../notifications/`; сервер **не** отримує `page`/`offset` для цієї кнопки — **`PAGINATION_SHOW_MORE_BACKEND.md`**.

---

**Останнє оновлення:** узгоджено з `NotificationViewSet`, `IsNotificationOwner`, `NotificationSerializer`, `signals.py` (bulk для закладок), `IsAuthenticated` / `JWTAuthentication` на ViewSet.
