# Зміна порядку та переміщення глав — Frontend

Документ описує **реальну** реалізацію UI зміни порядку глав та переміщення глав між томами на сторінці книги. Усі згадані файли та потоки відповідають поточному коду в проєкті.

---

## 1. Огляд

Система підтримує:

1. **Режим зміни порядку** — кнопка «Змінити порядок розділів»; стрілки вгору/вниз, поле позиції; збереження batch-запитами по контейнерах.
2. **Переміщення між томами** — кнопка «Перемістити в том» (тільки в режимі reorder); стрілки на межі тому; модальне вікно вибору цільового тому.

---

## 2. Джерела даних

| Джерело | Опис |
|---------|------|
| `GET /api/catalog/books/<slug>/chapters/` | Список глав + `container_versions` (ключі: `"null"` для без тому, `"<volume_id>"` для томів) |
| `POST /api/catalog/books/<slug>/chapters/reorder/` | Зміна порядку в контейнері |
| `POST /api/catalog/books/<slug>/chapters/<id>/move/` | Переміщення глави в інший том |

---

## 3. Потік даних

```text
BookDetailRouter
  -> useQuery chapters (GET .../chapters/)
  -> chapters, containerVersions
  -> BookDetailOwner
      -> BookChapters (reorderMode, chapterPositions, onPositionChange, onSaveOrder, onMove, onMoveToVolume)
      -> MoveChapterModal (для вибору цільового тому)
```

---

## 4. Компоненти

### 4.1. BookDetailOwner

**Файл:** `catalog/BookDetailOwner.tsx`

| State | Призначення |
|-------|-------------|
| `reorderMode` | Чи активний режим зміни порядку |
| `chapterPositions` | Локальні позиції глав (chapterId → order) |
| `saveError` | Текст помилки збереження |
| `isSavingOrder` | Чи виконується збереження порядку |
| `chapterToMove` | Глава для переміщення (відкриває MoveChapterModal) |
| `isMovingChapter` | Чи виконується переміщення |

**Ключові функції:**
- `enterReorderMode()` — ініціалізує `chapterPositions` з поточних `chapters`, вмикає режим.
- `exitReorderMode()` — вимикає режим, очищає позиції.
- `saveOrder()` — групує глави по контейнерах, для кожного викликає `catalogApi.reorderChapters()` з `ordered_ids` та `container_version`; при 409 — показує помилку, виходить з режиму.
- `handleMoveChapter(toVolumeId, toOrder)` — викликає `catalogApi.moveChapter()`, інвалідує chapters/book.
- `handleMoveChapterToVolume(chapter, toVolumeId, toOrder)` — те саме для переміщення зі стрілок на межі тому.

### 4.2. BookChapters

**Файл:** `catalog/sections/BookChapters.tsx`

| Проп | Призначення |
|------|-------------|
| `reorderMode` | Показує UI reorder (стрілки, поле позиції, «Перемістити в том») |
| `chapterPositions` | Локальні позиції для відображення та сортування |
| `onPositionChange` | Оновлення позицій (batch: id → position) |
| `onSaveOrder` | Підтвердження зміни порядку |
| `onCancelReorder` | Скасування режиму |
| `onMove` | Відкриває MoveChapterModal для глави |
| `onMoveToVolume` | Переміщення глави в інший том (для стрілок на межі тому) |

**Логіка:**
- У режимі reorder: замість «Редагувати» показується «Перемістити в том».
- Стрілки вгору/вниз: `handleSwapWithNeighbor` — обмін позицій двох глав; на межі тому — виклик `onMoveToVolume`.
- Поле позиції: локальний state `editingValue`, на blur/Enter — `applyPositionInput` (swap з главою на цій позиції або просто зміна позиції).
- `displayGrouped` — групує глави по томах, у reorder сортує за `chapterPositions`.

### 4.3. MoveChapterModal

**Файл:** `catalog/sections/MoveChapterModal.tsx`

- Вибір цільового тому (select).
- Опційне поле «Позиція» (1-based; якщо пусто — в кінець).
- `onConfirm(toVolumeId, toOrder)` — викликається з вибраними значеннями.

---

## 5. API-методи (catalogApi.ts)

### 5.1. reorderChapters

```typescript
reorderChapters(
  bookSlug: string,
  volumeId: number | null,
  orderedIds: number[],
  containerVersion?: number
): Promise<ReorderChaptersResponse>
```

- `volumeId === null` — контейнер «без тому».
- `containerVersion` — для optimistic locking; при 409 клієнт отримує нову версію та список глав.

### 5.2. moveChapter

```typescript
moveChapter(
  bookSlug: string,
  chapterId: number,
  toVolumeId: number | null,
  toOrder?: number
): Promise<MoveChapterResponse>
```

- Повертає `{ chapters, container_versions }`; після успіху клієнт інвалідує `catalogKeys.chapters(bookSlug)` та `catalogKeys.book(bookSlug)`.

---

## 6. Обробка помилок

| Ситуація | Поведінка |
|----------|-----------|
| 409 Conflict (reorder) | `saveError = "Порядок змінено в іншій вкладці. Оновіть список."`, `exitReorderMode()`, інвалідація chapters |
| Помилка move/reorder | `saveError` з текстом з `response.data.error` або `response.data.detail` |
| Успіх | `showSuccessAutoClose(...)`, інвалідація queries, при reorder — `exitReorderMode()` |

---

## 7. Ключі React Query

| Ключ | Використання |
|------|--------------|
| `catalogKeys.chapters(slug)` (= `["book-chapters", slug]`) | Список глав; інвалідується після reorder, move, createVolume, deleteChapter |
| `catalogKeys.book(slug)` | Дані книги; інвалідується після move, deleteChapter |
| `catalogKeys.volumes(slug)` | Томи; інвалідується після createVolume |

---

## 8. Файли

| Файл | Роль |
|------|------|
| `catalog/BookDetailOwner.tsx` | Управління reorder/move, state, виклики API |
| `catalog/sections/BookChapters.tsx` | UI таблиці глав, стрілки, поле позиції, кнопки |
| `catalog/sections/MoveChapterModal.tsx` | Модальне вікно вибору тому та позиції |
| `api/catalogApi.ts` | `reorderChapters`, `moveChapter`, `getChapters` (container_versions) |
| `catalog/BookDetailRouter.tsx` | Завантаження chapters з `container_versions`, передача в BookDetailOwner |
