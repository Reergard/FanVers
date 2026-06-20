# Прогрес читання (Frontend)

Документ описує збір прогресу на сторінці глави, статистику в профілі та метрики на **/my-translations**.

Повна логіка бекенду (`is_read`, пороги часу/скролу): **backend/docs/READING_PROGRESS_BACKEND.md**.

---

## 1. Навіщо це на фронті

| Функція | Файли |
|---------|--------|
| POST прогресу під час читання | `catalog/hooks/useReadingProgress.ts`, `ChapterDetail.tsx` |
| API-клієнт | `api/monitoringApi.ts`, `api/endpoints.ts` |
| Ключі React Query | `api/monitoringKeys.ts` |
| Статистика в профілі | `users/Profile.tsx` |
| Метрики автора на картці книги | `BookCard.tsx`, `api/catalogApi.ts` |
| Інвалідація stats після покупки/закладки | `ChapterDetailRouter`, `BookChapters`, `BookmarkButton` |

**Не змінює:** UI покупки, закладок, доступ до глав — лише надсилає дані на бекенд і показує агрегати.

---

## 2. API

### Ендпоінти (`api/endpoints.ts`)

| Константа | URL |
|-----------|-----|
| `API.chapterProgress(id)` | `GET\|POST /api/monitoring/chapters/{id}/progress/` |
| `API.readingStats` | `GET /api/monitoring/stats/` |
| `API.authorThanks` | `POST /api/monitoring/thanks/` (окремо — **BOOK_AUTHOR_THANKS_FRONTEND.md**) |

### Клієнт (`api/monitoringApi.ts`)

- `updateReadingProgress(chapterId, { reading_time, scroll_progress })`
- `getChapterProgress(chapterId)` — при старті сесії читання
- `getUserReadingStats()` — профіль

`scroll_speed` **не відправляється**.

### Ключі (`api/monitoringKeys.ts`)

```ts
monitoringKeys.readingStats()           // ["reading-stats"]
monitoringKeys.chapterProgress(id)    // ["chapter-progress", id]
```

---

## 3. Трекинг на сторінці глави

### Де підключено

**`catalog/ChapterDetail.tsx`** (варіант B): хук викликається в UI читалки, коли текст уже на екрані.

```ts
useReadingProgress({
  chapterId: chapterMeta.id,
  enabled: isAuthenticated && authReady && chapterId != null && chapterId > 0,
});
```

**Чому не в роутері:** до логіну / покупки `ChapterDetail` часто **не монтується** — таймер не стартує «вхолостую». Після входу або покупки компонент з’являється з новою сесією.

Ремаунт при зміні глави: `ChapterDetail` обгорнуто в `key={chapterSlug}`.

### Хук `useReadingProgress.ts`

**Refs** (без зайвих ре-рендерів): `readingStartTime`, `previousReadingTime`, `isRead`, `enabled`, `chapterId`, `sendInFlight`.

**Накопичення часу між сесіями:**

1. При старті — `GET /api/monitoring/chapters/{id}/progress/` для отримання вже збереженого `reading_time`.
2. Якщо `is_read === true` — POST-и не шлються (глава вже прочитана).
3. Якщо ні — `previousReadingTimeRef = existing.reading_time ?? 0`, таймер сесії стартує з `Date.now()`.
4. При відправці: `readingTime = previousReadingTimeRef + sessionSeconds` — кумулятивне значення, **не** дельта.

**Скрол:** `computeScrollProgress()` — `window.scrollHeight`, `pageYOffset`, % 0–100. **Якщо контент вміщується без скролла** (`totalHeight <= viewportHeight`), повертає **100** (короткі глави автоматично вважаються повністю прокрученими).

**Тригери відправки** (debounce 1 с на scroll):

1. Старт: GET прогресу → `resetSession(existingReadingTime)` → immediate POST
2. `window` scroll
3. `visibilitychange` + `document.hidden` → flush
4. `setInterval` 30 с
5. unmount → flush

**Захист від паралельних POST-ів:** `sendInFlightRef` запобігає одночасним запитам.

Помилки POST — **тихо** (не блокують читання). Бекенд додатково захищає дані через `max()` (час/скролл ніколи не зменшуються).

---

## 4. Статистика в профілі

**`users/Profile.tsx`:**

```ts
useQuery({
  queryKey: monitoringKeys.readingStats(),
  queryFn: getUserReadingStats,
  enabled: isAuthenticated && authReady,
  staleTime: 5 * 60 * 1000,
});
```

При вході на профіль — `invalidateQueries({ queryKey: monitoringKeys.readingStats() })`.

**Секція `.colStats`:**

- Прочитано розділів → `read_chapters`
- Придбано розділів → `purchased_chapters` (з `UserChapterAccess` на бекенді)
- Книг у статусі «Прочитав» → `completed_books` (закладки `completed`, не «усі глави прочитані»)

---

## 5. Інвалідація `readingStats`

Після дій, що змінюють покупки або закладки:

| Місце | Подія |
|-------|--------|
| `ChapterDetailRouter.tsx` | успішна покупка глави |
| `catalog/sections/BookChapters.tsx` | `purchaseChapterMutation`, `applyMutation` |
| `bookmarks/BookmarkButton.tsx` | `addMutation`, `updateMutation` |

```ts
queryClient.invalidateQueries({ queryKey: monitoringKeys.readingStats() });
```

---

## 6. /my-translations — картка книги

**Дані:** `GET /api/catalog/user-translations/` → `getUserTranslations()` → `normalizeUserTranslation()`.

**Тип `UserTranslationBook`** (`catalogApi.ts`): додатково до доходів/переглядів:

- `total_readers` — унікальні читачі з ≥1 прочитаною главою
- `completed_readers` — дочитали **усі** глави книги (`is_read` по кожній)

**Відображення:** `BookCard.tsx`, `variant="default"` — рядки після «Переглядів за день»:

- Читачів
- Дочитали до кінця
- Дохід за день / Дохід за місяць (як раніше — з `TransactionLog` на бекенді)

---

## 7. Рейтинг і коментарі (обробка 403)

Додаткових компонентів не потрібно — бекенд повертає 403 з текстом:

| Дія | Поле помилки | Компонент |
|-----|----------------|-----------|
| Оцінка книги | `error` | `BookRatingStars.tsx` |
| Коментар | `detail` | `BookCommentsContainer.tsx` |

Умови на бекенді: **READING_PROGRESS_BACKEND.md** §6.

---

## 8. Зв’язок з іншими документами

| Тема | Документ |
|------|----------|
| Сторінка глави, роутер, 403 | **CHAPTER_PAGE_DATA_FLOW.md** |
| Картки книг | **BOOK_CARDS_FRONTEND.md** |
| Рейтинги | **RATINGS_FRONTEND.md** |
| Коментарі | **COMMENTS_FRONTEND.md** |
| Профіль, ключі query | **USER_DATA_FLOW.md** |

---

**Останнє оновлення:** 2026-06-21 — накопичення reading_time між сесіями (GET при старті + previousReadingTimeRef); computeScrollProgress повертає 100 для коротких глав без скролла; sendInFlightRef проти паралельних POST-ів.
