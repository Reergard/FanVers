# Коментарі (Frontend)

Документ описує, як реалізовані коментарі до книг і глав на фронтенді: які файли залучені, потік від введення/кліків до успіху, валідація, захист від спаму, помилки та оновлення даних.

---

## 1. Огляд

Коментарі показуються на сторінці книги (власник і читач) та на сторінці глави. Завантаження списку коментарів відбувається **всередині секції коментарів** (BookCommentsContainer), а не в роутері сторінки книги. Підтримуються: основний коментар, відповіді, лайк/дизлайк, «лайк автора», видалення власного коментаря.

---

## 2. Файли та їх ролі

| Файл | Призначення |
|------|-------------|
| **api/endpoints.ts** | URL для коментарів: `bookComments(bookSlug)`, `chapterComments(chapterSlug)`, `commentReaction(type, commentId)`, `commentOwnerLike(type, commentId)`, `bookCommentDetail(bookSlug, commentId)`, `chapterCommentDetail(chapterSlug, commentId)`. |
| **api/reviewsApi.ts** | Типи `CommentUser`, `ApiComment`; функції: `fetchBookComments`, `postBookComment`, `fetchChapterComments`, `postChapterComment`, `updateReaction`, `updateOwnerLike`, `deleteComment`. Всі запити через `http` (Authorization + CSRF для POST/DELETE). |
| **api/http.ts** | Axios-клієнт з `Authorization: Bearer`, `X-CSRFToken` для небезпечних методів, 401 → refresh. Використовується в reviewsApi для всіх викликів. |
| **catalog/sections/BookCommentsContainer.tsx** | Контейнер: useQuery (завантаження коментарів), useMutation (reaction, ownerLike, delete), валідація `validateComment`, спам-захист `useSpamProtection`, маппінг API → UI (`mapApiCommentToItem`), обробники submit/reply/reaction/ownerLike/delete, показ помилок через `useNotification().showError`. Передає пропси в BookComments. |
| **catalog/sections/BookComments.tsx** | UI: тип `CommentItem`, компонент `CommentCard` (відповіді, реакції, лайк автора, кнопка видалення з `isDeletingId`), форма коментаря (controlled/uncontrolled через `commentValue`/`onCommentChange`), валідація тільки при `commentText.trim().length > 0`, порожній список — `emptyMessage`. |
| **catalog/BookDetailOwner.tsx** | Рендер `<BookCommentsContainer type="book" slug={book.slug} isOwner />` на сторінці книги власника. |
| **catalog/BookDetailReader.tsx** | Рендер `<BookCommentsContainer type="book" slug={book.slug} isOwner={false} />` на сторінці книги читача. |
| **catalog/BookDetailLayout.tsx** | Розмітка сторінки книги; секція коментарів вставляється як children (у власника/читача — BookCommentsContainer для книги). |
| **catalog/styles/BookDetail.module.css** | Стилі секції коментарів (`.comments`, `.commentForm`, `.commentItem`, `.commentReactions`, `.commentDeleteBtn` тощо). |
| **shared/NotificationModal/NotificationProvider.tsx** | Контекст `useNotification()` з методом `showError`; коментарі використовують тільки `showError` для помилок (без success-тостів). |

Для коментарів до **глави** використовується той самий `BookCommentsContainer` з `type="chapter"` та `slug={chapter.slug}` (якщо така секція підключена на сторінці глави).

---

## 3. Потік даних: від введення до успіху

### 3.1 Завантаження коментарів

- При монтуванні `BookCommentsContainer` з `slug` запускається `useQuery` з ключем `["book-comments", slug]` або `["chapter-comments", slug]`.
- `queryFn`: `reviewsApi.fetchBookComments(slug)` або `reviewsApi.fetchChapterComments(slug)` — GET на `/api/reviews/book/<slug>/comments/` або `/api/reviews/chapter/<slug>/comments/`.
- Відповідь: якщо бекенд повертає не масив (наприклад `{ detail: "..." }`), у `reviewsApi` використовується `Array.isArray(res.data) ? res.data : []`.
- Результат зберігається в `data`; через `mapApiCommentToItem` кожен коментар перетворюється на `CommentItem` (authorName, timeAgo, userReaction, canDelete тощо) і передається в `BookComments` як `comments`.
- При помилці запиту (`isError`) один раз показується `showError("Помилка при завантаженні коментарів...")` (через `hasShownFetchError` ref).

### 3.2 Відправка основного коментаря

1. Користувач вводить текст у головне поле (controlled: `commentValue={commentText}`, `onCommentChange={setCommentText}`).
2. На відправку форми викликається `handleSubmit(trimmed)` у контейнері.
3. Перевірки: `isAuthenticated`, `text.trim()` не порожній; `validateComment(text)` — якщо є помилка, показується `showError(err)` і вихід; `canComment()` (спам 5 с) — інакше `showError("Занадто швидко!...")`; `!isSubmitting`.
4. Виклик `postComment(text)` (тобто `postBookComment(slug, text)` або `postChapterComment(slug, text)`). Тіло: `{ text, parent: null }`.
5. Успіх: `setCommentText("")`, `recordComment()` (фіксує час для спам-захисту), `qc.invalidateQueries({ queryKey })` — список коментарів оновлюється при наступному зверненні; модальне повідомлення про успіх не показується.
6. Помилка: 403 — `showError(detail ?? "У вас немає прав...")`; інакше — `showError("Помилка при відправці коментаря: " + msg)`.

### 3.3 Відповідь на коментар

1. Клік «Відповісти» → `onReplyOpen(commentId)` → в контейнері `setReplyingToId(id)`.
2. Під карткою коментаря з’являється форма відповіді: `replyText`, `onReplyTextChange={setReplyText}`.
3. Клік по кнопці відправки викликає `onReply(commentId, replyText.trim())` → у контейнері `handleReplySubmit(parentId, text)`.
4. Ті самі перевірки: авторизація, `validateComment`, `canComment`, `!isSubmitting`. Потім `postComment(text, parentId)` — тіло `{ text, parent: parentId }`.
5. Успіх: `setReplyText("")`, `setReplyingToId(null)`, `recordComment()`, `invalidateQueries`. Помилки — аналогічно до основного коментаря (403 та загальна помилка через `showError`).

### 3.4 Лайк/дизлайк

1. Клік по кнопці «Вподобати» або «Невподобати» → `onReaction(commentId, "like" | "dislike")` → у контейнері `handleReaction(commentId, action)`.
2. Якщо не авторизований — нічого. Інакше `reactionMutation.mutate({ commentId, action })` → POST на `commentReaction(type, commentId)` з тілом `{ action }`.
3. Успіх: `onSuccess` → `invalidateQueries({ queryKey })`. Помилки реакцій у поточному коді не показуються користувачу окремим тостом (залишаються в mutation state).

### 3.5 Лайк автора

1. Кнопка «⭐ Автора» показується тільки якщо `showOwnerLikeButton` (власник книги і на коментарі ще немає лайка автора). Клік → `onOwnerLike(commentId)` → `ownerLikeMutation.mutate(commentId)`.
2. POST на `commentOwnerLike(type, commentId)` без тіла. Успіх — `invalidateQueries`. Помилки не обробляються окремим тостом.

### 3.6 Видалення коментаря

1. Кнопка «Видалити коментар» видна тільки якщо `canDelete` (поточний користувач — автор коментаря). Клік → `onDelete(comment.id)` → у контейнері `handleDelete(commentId)`.
2. Виклик `deleteMutation.mutateAsync(id)` → DELETE на `bookCommentDetail(slug, commentId)` або `chapterCommentDetail(slug, commentId)`.
3. Під час запиту кнопка disabled, текст «Видалення…»; `isDeletingId` передається з контейнера як `deleteMutation.isPending ? deleteMutation.variables : null`.
4. Успіх: `invalidateQueries`. Помилка: 403 — `showError(detail ?? "У вас немає прав для видалення...")`; інакше — `showError("Помилка при видаленні коментаря: " + msg)`.

---

## 4. Валідація тексту

- Функція `validateComment(text)` у `BookCommentsContainer.tsx`: порожній (після trim) → «Коментар не може бути порожнім»; довжина < 3 → «Коментар занадто короткий (мінімум 3 символи)»; > 1000 → «Коментар занадто довгий (максимум 1000 символів)». Повертає рядок помилки або `null`.
- У UI (`BookComments`) `validationError` показується тільки коли `commentText.trim().length > 0` (щоб не показувати помилку порожнього поля до введення). Кнопка «Надіслати» disabled при `disabled || !value.trim() || !!validationError`.
- На бекенді відповідна валідація в сериалізаторі (3–1000 символів після strip).

---

## 5. Спам-захист

- Хук `useSpamProtection()` у контейнері: мінімальний інтервал 5 секунд між коментарями.
- `canComment()`: якщо минуло менше 5 с — встановлює `isBlocked`, ставить таймер на залишок часу, потім скидає `isBlocked`; повертає `false`. Інакше повертає `true`.
- `recordComment()` викликається після успішної відправки основного коментаря або відповіді.
- При розмонтуванні таймер очищається в `useEffect` cleanup.
- Якщо користувач натисне відправку занадто швидко, показується `showError("Занадто швидко! Зачекайте 5 секунд...")`; також під формою виводиться підказка «Занадто швидко! Зачекайте перед наступним коментарем» коли `isBlocked`.

---

## 6. Авторизація та HTTP

- Усі запити до API коментарів йдуть через `http` з `api/http.ts`: для GET підставляється `Authorization: Bearer <access>`; для POST/DELETE додатково `X-CSRFToken`. При 401 виконується refresh і повтор запиту.
- Перевірка `isAuthenticated` на фронті: форма коментаря та кнопки реакцій/відповіді/видалення показуються лише авторизованим; логіка submit/reply/delete/reaction також перевіряє авторизацію.

---

## 7. Помилки та сповіщення

- Використовується тільки `useNotification().showError` (модальне/тост помилки). Success-повідомлення після відправки коментаря, відповіді або видалення не показуються.
- Показ помилок: помилка завантаження списку (один раз через ref); помилки 403 та загальні при submit/reply; помилки при видаленні (403 та інші). Тексти повідомлень узгоджені з тим, що повертає бекенд (detail) або захардкожені українською.

---

## 8. React Query

- Ключі: `["book-comments", slug]` або `["chapter-comments", slug]`.
- Після успішного create (основний коментар або відповідь), reaction, owner_like, delete викликається `qc.invalidateQueries({ queryKey })` — повторне отримання списку при наступному використанні даних; окремого refetch у коді немає.
- `staleTime: 5 * 60 * 1000`, `refetchOnWindowFocus: false`.

---

## 9. Доступність (a11y)

- Секція: `aria-labelledby="comments-heading"`, заголовок з `id="comments-heading"`.
- Форма: `aria-label="Додати коментар"`, поле вводу — `aria-label="Текст коментаря"`, кнопка відправки — `aria-label="Надіслати"`.
- Реакції: `aria-label` з кількістю вподобань/невподобань та дією кнопки (прибрати/поставити).
- Кнопка видалення: `aria-label="Видалити коментар від {authorName}"`.
- Список відповідей: `aria-label="Відповіді"`. Помилка валідації: `role="alert"`.

---

**Зв’язок з аналітикою (бекенд):** після успішного POST коментаря, DELETE, POST `update_reaction` (лайк/дизлайк на коментарі) сервер сам оновлює лічильники для зважених метрик (ТОП тощо); **лайк автора** (`owner_like`) у ці лічильники не входить. Не потрібно окремо викликати analytics API з фронту для цих дій. Деталі: `backend/docs/ANALYTICS_BOOKS_BACKEND.md`; каруселі: **LISTS_AND_CAROUSELS_FRONTEND.md**.

---

**Останнє оновлення:** 2026-03-21 — узгоджено з кодом frontend та аналітикою на бекенді.
