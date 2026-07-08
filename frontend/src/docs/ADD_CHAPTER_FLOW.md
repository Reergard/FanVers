# Додавання розділу (глави) — повний потік (Frontend)

Документ описує **реальну** логіку від натискання кнопки «Додати розділ» на сторінці книги до показу успішного повідомлення. Усі згадані файли та кроки відповідають поточному коду в проєкті.

---

## 1. Від кнопки до сторінки форми

### 1.1. Де знаходиться кнопка

- **Файл:** `catalog/BookDetailOwner.tsx`
- **Секція:** блок «Розділи» рендериться компонентом `BookChapters` з пропом `addChapterTo={`/books/${book.slug}/add-chapter`}``.

### 1.2. Як рендериться кнопка

- **Файл:** `catalog/sections/BookChapters.tsx`
- Якщо передано `addChapterTo`, кнопка «Додати розділ» рендериться як посилання React Router, а не як `<button>`:
  - `<ActionButton variant="primary" to={addChapterTo}>Додати розділ</ActionButton>`
- **ActionButton** (`shared/ActionButton/ActionButton.tsx`) при наявності пропа `to` рендерить `<Link to={to}>` з тими самими стилями. Клік — це перехід по маршруту, без перевірок у цьому файлі.

### 1.3. Маршрут

- **Файл:** `App.tsx`
- Маршрут: `path="/books/:slug/add-chapter"`, елемент: `<AddChapter />` (lazy через `React.lazy`), fallback: `<div />`.
- Маршрут оголошений **перед** `/books/:slug`, щоб саме він обробляв URL виду `/books/<slug>/add-chapter`.

**Підсумок:** натискання «Додати розділ» — це перехід на `/books/<slug>/add-chapter`, де монтується сторінка `AddChapter`.

---

## 2. Сторінка додавання розділу (AddChapter)

### 2.1. Файли

| Файл | Призначення |
|------|-------------|
| `catalog/AddChapter.tsx` | Єдиний компонент сторінки: перевірки доступу, форма, відправка. |
| `catalog/styles/AddChapter.module.css` | Стилі тільки для цієї сторінки (не використовується повний CreateBookPage.module.css). |
| `api/catalogApi.ts` | `getBook`, `getVolumes`, `uploadChapter`, `catalogKeys`. |
| `auth/useAuth.ts` | `isAuthenticated`, `userId`, `authReady`. |
| `shared/NotificationModal/NotificationProvider.tsx` | `useNotification()` → `showError`. |

### 2.2. Джерела даних

- **slug:** `useParams<{ slug: string }>()` з URL.
- **Користувач:** `useAuth()` — `isAuthenticated`, `userId`, `authReady` (з auth store, без додаткових запитів при відкритті сторінки).
- **Навігація:** `useNavigate()`.
- **Кеш:** `useQueryClient()` для інвалідації після успішного створення глави.

### 2.3. Скрол при відкритті

- У `AddChapter.tsx` використовується **useLayoutEffect** з `window.scrollTo(0, 0)` без залежностей.
- Скрол виконується до малювання кадру, щоб сторінка завжди відкривалась зверху.

### 2.4. Перевірки доступу (два ефекти)

**Ефект 1 — перевірка власника:**

- Умова запуску: `authReady && slug`.
- Якщо `!isAuthenticated`: показується помилка «Необхідна авторизація», редирект на `/books/${slug}`, вихід.
- Інакше викликається асинхронна функція `checkOwnerAccess()`:
  1. Якщо `userId == null` — помилка «Необхідна авторизація», редирект на `/books/${slug}`.
  2. `catalogApi.getBook(slug)` — завантаження книги.
  3. Порівняння: `userId !== (bookData.ownerId ?? bookData.owner)` — якщо не власник: помилка «У вас немає прав для додавання розділів до цієї книги», редирект на `/books/${slug}`.
  4. Якщо все ок — `setBook(bookData)`.
- При помилці запиту — `showError` з текстом помилки та редирект на `/books/${slug}`.
- У cleanup ефекту встановлюється прапорець `cancelled`, щоб після розмонтування не викликати `setBook` або редирект.

**Ефект 2 — завантаження томів:**

- Запускається при `authReady && isAuthenticated && slug` (не залежить від `book`).
- Викликається `catalogApi.getVolumes(slug)`; результат зберігається в state `volumes`.
- Томи потрібні для вибору в формі (опційний select «Том»). Запит виконується паралельно з перевіркою власника.

### 2.5. Стани відображення

- `!authReady` → рендер `<AddChapterLoader slug={slug} />` (хедер + «Завантаження…»).
- `!isAuthenticated` → `return null` (редирект уже виконано в ефекті).
- `!book` → знову `<AddChapterLoader slug={slug} />`.
- Інакше — форма з полями: назва розділу, файл .docx, чекбокс «Закритий доступ (потребує оплати)», при `isPaid` — поле ціни, при `volumes.length > 0` — select томів, кнопка «Додати розділ».

### 2.6. Валідація файлу (.docx)

- Обробник: `handleFileChange` (useCallback).
- Береться `e.target.files?.[0]`. Перевірка типу через допоміжну функцію **isDocxFile**: дозволено, якщо `file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'`, або `file.name.toLowerCase().endsWith('.docx')`, або `file.type === ''` і розширення `.docx` (для середовищ, де MIME не передається).
- Якщо файл не проходить перевірку: `setError('Будь ласка, завантажте файл у форматі .docx')`, `setFile(null)`, скидання значення input. Якщо проходить — `setError('')`, `setFile(selectedFile)`.

### 2.7. Відправка форми (handleUploadChapter)

1. `e.preventDefault()`, `setError('')`.
2. Перевірки:
   - Немає `title.trim()` або `file` → `setError("Заповніть усі обов'язкові поля")`, return.
   - Якщо `isPaid`: перевірка `price` (число, > 0, не NaN) — інакше помилка «Вкажіть коректну вартість глави».
   - Якщо вибрано том і `Number(selectedVolume)` дає NaN → помилка «Невірно обрано том».
3. `volumeId = selectedVolume ? Number(selectedVolume) : null`.
4. `setIsSubmitting(true)`, потім виклик:
   - `catalogApi.uploadChapter(slug, title.trim(), file, isPaid, volumeId, isPaid ? parseFloat(price) : 0)`.
5. При успіху:
   - Скидання полів форми (title, file, isPaid, selectedVolume, price, input file).
   - `invalidateBookChapterLists(queryClient, slug, book.id)` (якщо є `book.id`) або `catalogKeys.chapters(slug)`; також `catalogKeys.book(slug)`.
   - `navigate(\`/books/${slug}\`, { state: { chapterCreated: true } })` — перехід на сторінку книги з флагом у state.
6. При помилці: `setError(message)` (текст з `err.message` або «Помилка при завантаженні глави»).
7. У `finally`: `setIsSubmitting(false)`.

Кнопка сабміту має `disabled={isSubmitting}` та `loading={isSubmitting}` — захист від подвійного натискання.

---

## 3. API відправки глави (frontend)

- **Файл:** `api/catalogApi.ts`
- **Функція:** `uploadChapter(slug, title, file, isPaid, volumeId, price)`.
- Формується **FormData**: `title`, `file`, `is_paid` (рядок `"true"` / `"false"`), за наявності `volume` (id тому), `price` (рядок числа).
- Запит: `POST /api/catalog/books/${slug}/add_chapter/`, тіло — multipart/form-data, клієнт `http` (Bearer, 401 → refresh).

---

## 4. Після редиректу: успішне повідомлення на сторінці книги

### 4.1. Хто показує успіх

- **Файл:** `catalog/BookDetailRouter.tsx`
- При монтуванні/оновленні перевіряється `location.state?.chapterCreated === true` у **useEffect**.
- Якщо так: викликається `showSuccessAutoClose("Розділ успішно створено")`, потім `navigate(location.pathname, { replace: true, state: {} })` — щоб при оновленні сторінки state не лишався і модалка не показувалась повторно.

### 4.2. Як працює showSuccessAutoClose

- **Файл:** `shared/NotificationModal/NotificationProvider.tsx`
- У контексті є метод **showSuccessAutoClose(message)**. Він встановлює state: `{ open: true, message, type: 'success', variant: 'autoClose' }`.
- Залежно від **variant** рендериться або **AutoCloseNotificationModal** (variant `'autoClose'`), або звичайний **NotificationModal** (variant `'default'`).
- Для `variant === 'autoClose'` рендериться `AutoCloseNotificationModal` з пропами `open`, `onClose`, `message`, `autoCloseMs={3000}`.

### 4.3. AutoCloseNotificationModal

- **Файл:** `shared/NotificationModal/AutoCloseNotificationModal.tsx`
- Використовує **Modal** з `showCloseButton={false}` — без крестика. У тілі — лише текст повідомлення, без кнопки «Зрозуміло».
- У **useEffect** при `open && autoCloseMs > 0` встановлюється таймер на `autoCloseMs` мс; по закінченні викликається `onClose()`. У cleanup таймер скидається.
- Константа **AUTO_CLOSE_MS = 3000** задана в `NotificationProvider.tsx`.

Підсумок: після успішного створення глави користувач потрапляє на сторінку книги, BookDetailRouter показує модалку «Розділ успішно створено» без кнопок; вона сама зникає через 3 секунди.

---

## 5. Схема потоку (коротко)

```
Сторінка книги (Owner)
  → BookChapters з addChapterTo="/books/{slug}/add-chapter"
  → Клік по Link «Додати розділ»
  → Перехід на /books/:slug/add-chapter
  → AddChapter: useLayoutEffect scrollTo(0,0)
  → AddChapter: !authReady → Loader; !isAuthenticated → редирект + showError
  → checkOwnerAccess(): getBook(slug), порівняння userId з owner → setBook або редирект + showError
  → Паралельно getVolumes(slug) → setVolumes
  → Форма: title, file (.docx), isPaid, price, volume; handleFileChange (isDocxFile), handleUploadChapter
  → uploadChapter() → POST add_chapter/
  → Успіх: invalidateBookChapterLists (chapters + paginated pages) + book, navigate(/books/${slug}, { state: { chapterCreated: true } })
  → BookDetailRouter: useEffect бачить state.chapterCreated → showSuccessAutoClose(...), navigate(..., state: {})
  → AutoCloseNotificationModal показується 3 с, потім onClose (таймер)
```

---

## 6. Масове завантаження розділів (Bulk Upload)

### 6.1. Розташування

Секція масового завантаження знаходиться **на тій самій сторінці** `AddChapter.tsx`, всередині форми — після блоку завантаження одного `.docx` файлу і перед чекбоксом «Закритий доступ». Це `<div>` з власними state-змінними та обробниками. Всі кнопки мають `type="button"`, щоб не ініціювати submit форми.

### 6.2. Стани

- `bulkFiles: File[]` — обрані файли .docx.
- `bulkTitles: Record<string, string>` — назви розділів (ключ = індекс файлу).
- `bulkSubmitting: boolean` — блокування кнопки під час запиту.
- `bulkResult: BulkUploadResult | null` — результат (created + errors).
- `bulkError: string` — помилки валідації на фронті.

### 6.3. Потік користувача

1. Натискає кнопку «Обрати файли .docx» → відкривається файловий діалог з `multiple`.
2. Фронтенд валідує: тільки .docx, максимум 20 файлів, сумарно ≤ 100 МБ.
3. Відображається список файлів: ім’я файлу + поле вводу з автоматичною назвою (з імені файлу без .docx).
4. Користувач може відредагувати назву кожного розділу, видалити окремі файли зі списку, або очистити весь список.
5. Натискає «Завантажити N розділ(ів)» → `catalogApi.uploadChaptersBulk()`.
6. При успіху без помилок: кеш інвалідується, редирект на сторінку книги.
7. При partial success (є і created, і errors): кеш інвалідується, список очищається, результат показується на сторінці (зелене повідомлення про створені + червоний список помилок).

### 6.4. API

- **Функція:** `catalogApi.uploadChaptersBulk(slug, files, titles, isPaid, volumeId, price)`.
- Формується **FormData**: `files` (multiple), `titles` (JSON-рядок), `is_paid`, `volume`, `price`.
- Запит: `POST /api/catalog/books/${slug}/add_chapters_bulk/`.
- Відповідь: `BulkUploadResult { created: [...], errors: [...] }`.

### 6.5. Спільні контролі

Масове завантаження використовує ті ж `isPaid`, `price`, `selectedVolume` з батьківського компонента, що й форма створення одного розділу.

### 6.6. CSS

Стилі в `AddChapter.module.css`: `.bulkSection`, `.bulkTitle`, `.bulkHint`, `.bulkPickBtn`, `.bulkList`, `.bulkItem`, `.bulkItemFile`, `.bulkItemInput`, `.bulkItemRemove`, `.bulkError`, `.bulkSuccess`, `.bulkErrors`.

---

## 7. Пов’язані документи

- Backend: `backend/docs/ADD_CHAPTER_BACKEND.md` — ендпоінт add_chapter, перевірки, форма запиту.
- Сторінка книги: [BOOK_PAGE_DATA_FLOW.md](./BOOK_PAGE_DATA_FLOW.md), [BOOK_PAGE_DESIGN_DATA_FLOW.md](./BOOK_PAGE_DESIGN_DATA_FLOW.md), [CHAPTER_PAGINATION_FRONTEND.md](./CHAPTER_PAGINATION_FRONTEND.md).
- Уведомлення (toast): [NOTIFICATIONS_FRONTEND.md](./NOTIFICATIONS_FRONTEND.md) (секція про NotificationProvider та AutoClose).

**Останнє оновлення:** за поточним коду в проєкті.
