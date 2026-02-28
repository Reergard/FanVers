# Створення книги та Налаштування книги — Frontend

Документ описує **реальну** логіку сторінок «Створення» та «Налаштування книги»: файли, перевірки, кнопки, потік даних від натискання до успіху. Усе відповідає поточному коду в проєкті.

---

## 1. Маршрути

| Сторінка | URL | Компонент | Захист |
|----------|-----|------------|--------|
| Створення книги | `/create-book` | CreateBookPage | RequireAuth (редирект на /login) |
| Налаштування книги | `/books/:slug/settings` | SettingsBook | Перевірка власника в useEffect |

Маршрути оголошені в `App.tsx`. Маршрут `/books/:slug/settings` оголошений **перед** `/books/:slug`, щоб коректно обробляти URL виду `/books/<slug>/settings`.

---

## 2. Сторінка створення книги (CreateBookPage)

### 2.1. Файли

| Файл | Призначення |
|------|-------------|
| `catalog/CreateBookPage.tsx` | Обгортка RequireAuth + CreateBookPageInner, хлібні крихти, заголовок, BookForm |
| `catalog/components/BookForm/BookForm.tsx` | Універсальна форма (mode="create" або "update") |
| `catalog/components/BookForm/BookForm.module.css` | Стилі форми |
| `catalog/components/BookForm/bookForm.utils.ts` | validateBookForm, normalizeBookPayload, константи |
| `catalog/hooks/useBookFormMeta.ts` | Жанри, теги, країни, фандоми, tagGroups, adultTagId |
| `api/catalogApi.ts` | createBook, getGenres, getTags, getCountries, getFandoms |
| `auth/RequireAuth.tsx` | Редирект на /login при невдалій перевірці (authStatus/refreshSession) |

### 2.2. Джерела даних

- **meta:** `useBookFormMeta()` — паралельні useQuery для genres, tags, countries, fandoms. Результат: `genres`, `tags`, `countries`, `fandoms`, `tagGroups`, `adultTagId`, `isLoading`.

### 2.3. Потік при натисканні «Опублікувати переклад»

1. **BookForm** у `handleSubmit` (preventDefault): `validateBookForm(formData, { mode: "create" })` — помилки для title, author, genres, country, original_status, translation_status (для TRANSLATION); заборонені для нових книг: PAUSED, ABANDONED (`INVALID_NEW_BOOK_TRANSLATION_STATUSES`).
2. **Payload:** `normalizeBookPayload(formData, "create")` → CreateBookPayload.
3. **BookForm** викликає `onSubmit(payload)` → **CreateBookPageInner** передає в `createBookMutation.mutate(payload)`.
4. **createBook** (`catalogApi.ts`): FormData, `POST /api/catalog/books/create/`, multipart/form-data.
5. **Успіх:** `showSuccess("Книга успішно створена!")`, `navigate("/my-translations")`.
6. **Помилка:** 401 → «Необхідна авторизація. Увійдіть знову.»; 403 → «У вас немає прав для створення книг.»; інше — details з backend або загальне повідомлення.

---

## 3. Сторінка налаштувань книги (SettingsBook)

### 3.1. Файли

| Файл | Призначення |
|------|-------------|
| `catalog/settings/SettingsBook.tsx` | Контейнер: вкладки (Загальні, Підписка, Реклама, Доступ), breadcrumbs, GeneralSettings для вкладки «Загальні» |
| `catalog/settings/GeneralSettings.tsx` | Завантаження книги, формування initialValues, рендер BookForm (mode="update") |
| `catalog/settings/SettingsBook.css` | Стилі сторінки налаштувань |
| `catalog/hooks/useBookBySlug.ts` | useQuery для GET книги за slug |
| `catalog/hooks/useBookUpdate.ts` | useMutation для PUT оновлення книги |
| `api/catalogApi.ts` | getBook, updateBook, catalogKeys |

### 3.2. Перевірки доступу (SettingsBook)

1. **useEffect:** при `authReady && book` перевіряється `userId == null` або `book.owner !== userId`. Якщо так — `showError`, `navigate(\`/books/${slug}\`, { replace: true })`.
2. **Перед рендером:** якщо `!authReady || isLoading` — «Завантаження налаштувань…», якщо `!book` — «Книгу не знайдено», якщо `userId == null || book.owner !== userId` — `return null`.

### 3.3. GeneralSettings: формування initialValues

- Книга береться з `useBookBySlug(slug)`.
- **initialValues** (useMemo): title, title_en, author, description, book_type, translation_status (маппінг з API на внутрішні значення), original_status, country.id, genres[], tags[], fandoms[], adult_content. `image` завжди `null` (новий файл не підвантажується в форму).

### 3.4. Потік при натисканні «Зберегти зміни»

1. **BookForm** у `handleSubmit`: `validateBookForm(formData, { mode: "update" })` — на update не застосовується обмеження PAUSED/ABANDONED для translation_status.
2. **Payload:** `normalizeBookPayload(formData, "update")` → UpdateBookPayload.
3. **GeneralSettings** `onSubmit`: перевіряє `userId == null || book.owner !== userId` → showError, navigate на книгу, return; інакше викликає `updateBookMutation.mutate(payload, { onSuccess, onError })`.
4. **updateBook** (`catalogApi.ts`): FormData, `PUT /api/catalog/books/<slug>/update/`, без явного Content-Type (axios виставляє multipart з boundary).
5. **Успіх:** `queryClient.invalidateQueries({ queryKey: catalogKeys.book(slug) })`, `showSuccess("Налаштування книги оновлено")`, `window.scrollTo(0, 0)`, `navigate(\`/books/${slug}\`)`.
6. **Помилка:** showError з `err.message` або «Не вдалося оновити книгу».

---

## 4. BookForm — спільна форма

### 4.1. Режими (mode)

- **create:** всі поля редаговні, початкові значення з `initialFormData`.
- **update:** частина полів тільки для читання (title, title_en, author, book_type, country). Редаговані: description, original_status, translation_status, adult_content, genres, tags, fandoms, image.

### 4.2. Поля та особливості

- **Теги:** групи з `meta.tagGroups`. На create — спочатку 1 група, кнопка «Показати ще» показує всі групи. На update — одразу всі групи, кнопки немає.
- **Контент 18+:** чекбокс синхронізований з тегом «18+» (adultTagId). Якщо вибрано 18+ — тег додається/прибирається з `tags`.
- **Зображення:** max 5 МБ, тільки image/*. На update — можна залишити поточне (image=null у payload) або завантажити нове.
- **Опис:** лічильник слів (max 250 — `DESCRIPTION_MAX_WORDS`).

### 4.3. handleSubmit

1. `e.preventDefault()`, якщо `submitting` — return.
2. `validateBookForm(formData, { mode })` → масив помилок. Якщо є — `onError(errors.join(". "))`, return.
3. `normalizeBookPayload(formData, mode)` → payload.
4. `onSubmit(payload)`.

---

## 5. Валідація (bookForm.utils.ts)

### validateBookForm

- title не пустий;
- author не пустий;
- description max 250 слів;
- genres.length > 0;
- country вибрана, Number(country) не NaN;
- original_status вибрано;
- для TRANSLATION: translation_status вибрано;
- для create + TRANSLATION: translation_status не PAUSED, не ABANDONED.

### normalizeBookPayload

- trim для title, title_en, author, description;
- country → Number;
- book_type === "AUTHOR" → translation_status = null;
- image → undefined якщо null.

---

## 6. Хуки

| Хук | Файл | Призначення |
|-----|------|-------------|
| useBookFormMeta | hooks/useBookFormMeta.ts | genres, tags, countries, fandoms, tagGroups, adultTagId |
| useBookBySlug | hooks/useBookBySlug.ts | GET книга за slug (catalogKeys.book) |
| useBookUpdate | hooks/useBookUpdate.ts | PUT updateBook(slug, payload) |

---

## 7. Кнопки та навігація

- **CreateBookPage:** кнопка «Опублікувати переклад» (submitLabel) — сабміт форми.
- **GeneralSettings:** кнопка «Зберегти зміни» — сабміт форми.
- **SettingsBook:** вкладки (кнопки) перемикають activeTab; для «Загальні» рендериться GeneralSettings.

---

## 8. ScrollToTop

- `ScrollToTop` (shared/ScrollToTop.tsx) монтується в App.tsx всередині BrowserRouter.
- При зміні pathname викликає `window.scrollTo(0, 0)`.
- Додатково в GeneralSettings перед `navigate` викликається `window.scrollTo(0, 0)`.

---

## 9. Пов'язана документація

- Backend: `backend/docs/BOOK_CREATE_UPDATE_BACKEND.md`
- Компоненти: `docs/COMPONENTS.md`
- Структура: `docs/STRUCTURE.md`

**Останнє оновлення:** за поточним коду в проєкті.
