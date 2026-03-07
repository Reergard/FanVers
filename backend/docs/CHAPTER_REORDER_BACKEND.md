# Зміна порядку та переміщення глав — Backend

Документ описує **реальну** реалізацію ендпоінтів зміни порядку глав у томі та переміщення глав між томами. Усі згадані файли та формати відповідають поточному коду в проєкті.

---

## 1. Огляд

Система підтримує два типи операцій:

1. **Reorder** — зміна порядку глав у межах одного контейнера (тому або «без тому»).
2. **Move** — переміщення глави в інший том або в «розділи без тому».

Для optimistic concurrency використовується модель `ChapterOrderContainer` з полем `version`.

---

## 2. Моделі та обмеження

### 2.1. Chapter

- Поле `order` (PositiveIntegerField) — позиція глави в контейнері.
- Унікальність: `(book, volume, order)` для глав з томом; `(book, order)` для глав без тому.

### 2.2. ChapterOrderContainer

```python
# apps/catalog/models.py
class ChapterOrderContainer(models.Model):
    book = models.ForeignKey(Book, ...)
    volume = models.ForeignKey(Volume, ..., null=True)  # null = "без тому"
    version = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)
```

- Контейнер = пара `(book_id, volume_id)`. `volume_id=NULL` означає «розділи без тому».
- `version` збільшується при кожній зміні порядку або переміщенні.
- Клієнт передає `container_version` для optimistic locking; при розбіжності повертається 409 Conflict.

---

## 3. URL та маршрути

| Ендпоінт | URL | View |
|----------|-----|------|
| Reorder | `POST /api/catalog/books/<slug>/chapters/reorder/` | `reorder_chapters` |
| Move | `POST /api/catalog/books/<slug>/chapters/<id>/move/` | `move_chapter` |

**Пов’язаний ендпоінт:** `GET /api/catalog/books/<slug>/chapters/` (`chapter_list`) повертає `{ chapters, container_versions }` — `container_versions` потрібні клієнту для optimistic locking при reorder.

**Файли:**
- `apps/catalog/api/urls.py` — маршрути, view імпортуються з `apps.editors.api.views`.
- `apps/editors/api/views.py` — фактична реалізація `reorder_chapters`, `move_chapter`.

Маршрути `reorder` та `move` розташовані **перед** `chapters/<slug:chapter_slug>/`, щоб рядок `reorder` не інтерпретувався як slug глави.

---

## 4. Reorder — зміна порядку в контейнері

### 4.1. Запит

```
POST /api/catalog/books/<book_slug>/chapters/reorder/
Content-Type: application/json

{
  "volume_id": null | <int>,   // null = "без тому"
  "ordered_ids": [1, 5, 3, 2, 4],
  "container_version": 1       // опційно, для optimistic locking
}
```

- `ordered_ids` — масив id глав у потрібному порядку (порядок елементів = позиції 1, 2, 3…; значення = id глав).
- `ordered_ids` має містити **всі** глави контейнера, без дублікатів.

### 4.2. Відповіді

**Успіх (200):**
```json
{
  "volume_id": null,
  "container_version": 2,
  "chapters": [
    {"id": 1, "order": 1},
    {"id": 5, "order": 2},
    ...
  ]
}
```

**Конфлікт версії (409):**
```json
{
  "detail": "Порядок змінено в іншій вкладці. Оновіть список.",
  "container_version": 3,
  "chapters": [{"id": 1, "order": 1}, ...]
}
```

### 4.3. Логіка

1. Перевірка власника: `request.user == book.owner`.
2. Валідація `ordered_ids` (не пустий, унікальні, всі належать контейнеру).
3. `select_for_update()` на контейнері.
4. Якщо `container_version` передано і не збігається — 409.
5. Двофазне оновлення `order` (тимчасові значення OFFSET+id, потім фінальні 1,2,3…) для уникнення порушення UniqueConstraint.
6. Інкремент `container.version`, збереження.

---

## 5. Move — переміщення глави між томами

### 5.1. Запит

```
POST /api/catalog/books/<book_slug>/chapters/<chapter_id>/move/
Content-Type: application/json

{
  "to_volume_id": null | <int>,
  "to_order": 3               // опційно, 1-based; якщо не вказано — в кінець
}
```

### 5.2. Відповідь (200)

```json
{
  "chapters": [...],           // повний список глав книги (ChapterSerializer)
  "container_versions": {
    "null": 2,
    "5": 3
  }
}
```

Ключі в `container_versions`: `"null"` для контейнера без тому, `"<volume_id>"` для томів.

### 5.3. Логіка

1. Перевірка власника.
2. Валідація: глава існує, том належить книзі, `src_volume_id != to_volume_id`.
3. `_lock_containers_in_order(book_id, src_vol_id, to_vol_id)` — блокування обох контейнерів у детермінованому порядку (уникнення дедлоку).
4. Перенесення глави: `volume_id`, `order`; зсув інших глав у цільовому контейнері при потребі.
5. `_normalize_container_order` для обох контейнерів.
6. Інкремент `version` обох контейнерів.
7. Повернення повного списку глав і `container_versions`.

---

## 6. Допоміжні функції

| Функція | Призначення |
|---------|-------------|
| `_normalize_container_order(book_id, volume_id)` | Нормалізує `order` до 1,2,3… Двофазно (OFFSET+id → фінальні значення) для уникнення UniqueConstraint. |
| `_lock_containers_in_order(book_id, vol_a, vol_b)` | Блокує два контейнери в детермінованому порядку (за ключем `(book_id, vol_id)`) для уникнення дедлоку. |

Обидві функції знаходяться в `apps/editors/api/views.py`.

---

## 7. Помилки

| Код | Умова |
|-----|-------|
| 403 | Користувач не власник книги |
| 400 | Невірні `ordered_ids`, том не належить книзі, глава вже в цільовому томі, `to_order < 1` |
| 404 | Книга або глава не знайдена |
| 409 | Конфлікт версії контейнера (reorder) |

---

## 8. Файли

| Файл | Роль |
|------|------|
| `apps/catalog/api/urls.py` | Маршрути `chapters/reorder/`, `chapters/<id>/move/`; імпорт view з editors |
| `apps/editors/api/views.py` | `reorder_chapters`, `move_chapter`, `_normalize_container_order`, `_lock_containers_in_order` |
| `apps/catalog/models.py` | `Chapter`, `ChapterOrderContainer`, UniqueConstraint для order |
| `apps/catalog/api/serializers.py` | `ChapterSerializer` для відповіді move |
