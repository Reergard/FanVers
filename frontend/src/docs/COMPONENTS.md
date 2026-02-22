# Переиспользование компонентов (Component Reusability)

Цей документ описує **переиспользуемые компоненты** проекту, їх призначення та місця використання. Документ буде оновлюватися при додаванні нових компонентів або зміні місць їх використання.

> **Принцип DRY (Don't Repeat Yourself):** Компоненти в `shared/` та `widgets/` створені для уникнення дублювання коду та забезпечення консистентності UI по всьому проекту.

---

## `shared/` — Переиспользуемые UI-компоненты

### `ActionButton`

**Призначення:** Універсальна кнопка дії, яка може працювати як `<button>` або `<a>` посилання.

**Особливості:**
- Підтримка prop `as` для вибору типу елемента (`button` або `a`); опційний prop **`to`** — при передачі рендериться `<Link to={to}>` (React Router) замість button.
- Підтримка **`loading`** (показ спінера та disabled під час відправки).
- Автоматична підтримка `aria-label` для доступності.
- Єдині стилі для всіх кнопок дій у проекті.

**Місця використання:**
- `website_advertising/BookAdCard/BookAdCard.tsx` — кнопка "Читати" на картці книги
- `catalog/sections/BookChapters.tsx` — кнопка "Додати розділ" як `<ActionButton to={addChapterTo}>` (Link на `/books/:slug/add-chapter`), кнопки "Створити том", "Змінити порядок розділів"
- `catalog/AddChapter.tsx` — кнопка сабміту форми «Додати розділ» (type="submit", loading={isSubmitting})
- `catalog/sections/BookHero.tsx` — кнопка «Стати новим перекладачем»
- `catalog/sections/BookActions.tsx` — кнопки "В закладки", налаштування
- `catalog/AbandonedTranslations.tsx` — кнопка "Читати" під карткою покинутого перекладу
- `auth/LoginForm.tsx` — кнопка входу
- `auth/RegisterForm.tsx` — кнопка реєстрації
- `shared/NotificationModal/NotificationModal.tsx` — кнопка "Зрозуміло" для закриття уведомлення
- `widgets/header/UserMenuOverlay/UserMenuOverlay.tsx` — кнопки "Вхід" і "Реєстрація" в меню неавторизованого користувача
- `navigation/ShowMoreNavigation.tsx` — через `ShowMoreButton` для кнопки "Показати ще" (єдина обгортка пагінації списків)

**Приклад використання:**
```tsx
<ActionButton onClick={onRead} ariaLabel={`Читати: ${title}`}>
  Читати
</ActionButton>
```

**Майбутнє використання:** Може використовуватися в будь-якому місці, де потрібна стандартизована кнопка дії (форми, модальні вікна, картки тощо).

---

### `ShowMoreNavigation`

**Призначення:** Єдина обгортка для кнопки `Показати ще` і логіки її видимості.

**Файли:**
- `navigation/ShowMoreNavigation.tsx`
- `navigation/ShowMoreNavigation.module.css`

**Як працює:**
- Приймає `visibleCount`, `totalCount`, `onShowMore`.
- Якщо `visibleCount >= totalCount`, повертає `null` (кнопка не рендериться).
- Якщо елементи ще є, рендерить `ShowMoreButton` і передає `onClick={onShowMore}`.

**Місця використання:**
- `catalog/Catalog.tsx`
- `catalog/AbandonedTranslations.tsx`
- `bookmarks/BookmarksPage.tsx`
- `users/UserTranslations.tsx`
- `users/Authors.tsx`
- `users/TranslatorsList.tsx`
- `notification/NotificationsPage.tsx`
- `catalog/CreateBookPage.tsx` (для груп тегів)

**Деталі:** `docs/PAGINATION_SHOW_MORE_FRONTEND.md`.

---

### `SortByNavigation`

**Призначення:** Єдина обгортка для UI-контролу `Сортувати` / `Сортувати за`.

**Файли:**
- `navigation/SortByNavigation.tsx`
- `navigation/SortByNavigation.module.css`

**Як працює:**
- Приймає `value`, `options`, `onChange`, `ariaLabel`.
- Показує текст поточної опції (`currentLabel`) на pill.
- Рендерить нативний `select` (прозорий поверх pill) і викликає `onChange(nextValue)` при виборі.
- Не містить власної бізнес-логіки сортування, тільки UI-вибір.

**Місця використання:**
- `users/Authors.tsx`
- `users/TranslatorsList.tsx`
- `catalog/Catalog.tsx`
- `catalog/AbandonedTranslations.tsx`
- `bookmarks/BookmarksPage.tsx`

**Деталі:** `docs/SORT_BY_NAVIGATION_FRONTEND.md`.

---

### `Container`

**Призначення:** Обгортка для контенту, яка забезпечує:
- Центрування контенту (`max-width: 1280px`, на 4K — `1680px`)
- Адаптивні бічні відступи (`clamp()` для різних екранів)
- Підтримка різних HTML-тегів через prop `as`

**Особливості:**
- Підтримка prop `as` для вибору семантичного тега (`div`, `section`, `header`, `footer`)
- Адаптивні відступи через CSS-змінну `--vwu` (обмеження впливу `vw`)

**Місця використання:**
- `main/HomePage.tsx` — обгортка для контенту головної сторінки
- `widgets/header/Header.tsx` — обгортка для контенту хедера
- `widgets/footer/Footer.tsx` — обгортка для контенту футера
- `website_advertising/AdvertisingBooks.tsx` — обгортка для секції реклами книг

**Приклад використання:**
```tsx
<Container>
  <div>Контент сторінки</div>
</Container>

<Container as="section">
  <h2>Секція</h2>
</Container>
```

**Майбутнє використання:** Використовується на всіх сторінках та в великих секціях для забезпечення консистентної ширини та відступів.

---

### `FrameLink`

**Призначення:** Стилізоване навігаційне посилання з рамкою, яке інтегрується з React Router.

**Особливості:**
- Автоматичне підсвічування активного посилання через `NavLink`
- Єдині стилі для навігаційних посилань у проекті
- Підтримка активного стану через CSS клас `.active`

**Місця використання:**
- `widgets/header/Header.tsx` — навігаційні посилання в хедері (Каталог, Чарівний Гід, Автори тощо)

**Приклад використання:**
```tsx
<FrameLink to="/catalog">Каталог</FrameLink>
<FrameLink to="/authors">Автори</FrameLink>
```

**Майбутнє використання:** Може використовуватися в будь-якому місці, де потрібні навігаційні посилання з рамкою (бічне меню, футер тощо).

---

### `Icon`

**Призначення:** Компонент для рендерингу іконок з глобального SVG-спрайту (`public/sprite.svg`).

**Особливості:**
- Використовує `<use href="#icon-name" />` для підключення іконок зі спрайту
- Підтримка `title` та `aria-hidden` для доступності
- Можливість передачі додаткових CSS класів

**Місця використання:**
- `widgets/header/Header.tsx` — іконки пошуку, бургер-меню, шеврон тощо
- `widgets/footer/Footer.tsx` — іконки соцмереж (Facebook, Instagram, YouTube)
- `shared/MenuPanel/MenuPanel.tsx` — іконка рамки для CTA-кнопки
- `shared/MenuList/MenuList.tsx` — іконки пунктів меню користувача
- `catalog/CreateBookPage.tsx` — іконка чекбокса "Контент 18+"
- `catalog/AbandonedTranslations.tsx` — іконки чекбоксів у фільтрах

**Приклад використання:**
```tsx
<Icon name="search" className={styles.icon} title="Пошук" />
<Icon name="burger" aria-hidden="true" />
```

**Майбутнє використання:** Використовується скрізь, де потрібні іконки з глобального спрайту.

---

### `BookAdCard`

**Призначення:** Картка реклами книги з обкладинкою, заголовком, описом та кнопкою "Читати". Підтримує варіант `bookmark` для сторінки закладок.

**Особливості:**
- Адаптивна ширина (`width: 100%` від обгортки каруселі)
- Підтримка вікового рейтингу (18+ badge)
- Декоративний еліпс на фоні через CSS-змінну (тільки для `variant="ad"`)
- Використовує `ActionButton` для кнопки дії
- `variant="bookmark"` — компактний дизайн: без еліпса, з іконкою закладки на обкладинці, outline-кнопка

**Місця використання:**
- `website_advertising/AdvertisingBooks.tsx` — картки книг у каруселі реклами
- `bookmarks/BookmarksPage.tsx` — картки закладок (`variant="bookmark"`)

**Приклад використання:**
```tsx
<BookAdCard
  coverSrc={coverPlaceholder}
  title="ХАОТИЧНИЙ БОГ МЕЧА"
  description="Опис книги..."
  isAdult={true}
  adultBadgeSrc={badge18}
  onRead={() => console.log("READ")}
/>

<BookAdCard
  variant="bookmark"
  coverSrc={coverUrl}
  title="Назва книги"
  isAdult={false}
  adultBadgeSrc={badge18}
  onRead={() => navigate(`/books/${slug}`)}
/>
```

**Майбутнє використання:** Може використовуватися в каталозі книг, на сторінках авторів, в рекомендаціях тощо.

---

### `BookCard`

**Призначення:** Переиспользовувана картка книги/перекладу з обкладинкою, назвою, 18+ бейджем, декоративною літерою та базовим блоком метаданих.

**Файли:**
- `BookCard/BookCard.tsx`
- `BookCard/BookCard.css`

**Особливості:**
- Працює з типом книги із `api/catalogApi.ts` (slug, title, image, adult_content, created_at, last_updated, daily views/income).
- Якщо є `slug` — картка клікабельна (`Link` на `/books/:slug`), інакше рендериться неклікабельний варіант.
- Зображення обкладинки бере з `book.image`; якщо порожнє — використовує локальний placeholder.
- На сторінці покинутих перекладів базовий блок метаданих цієї картки приховується локальними стилями сторінки, а поверх додається власний блок статусу/тегів.

**Місця використання:**
- `users/UserTranslations.tsx`
- `catalog/AbandonedTranslations.tsx`

---

### `MenuPanel`, `MenuList`, `AvatarOrbit`

**Призначення:** Компоненти для рендерингу меню користувача з аватаром та списком пунктів.

**Особливості:**
- `MenuPanel` — контейнер з аватаром, ім'ям користувача, CTA-кнопкою та списком меню
- `MenuList` — список пунктів меню з іконками та посиланнями
- `AvatarOrbit` — декоративний компонент аватара з SVG-орбитою

**Місця використання:**
- `widgets/header/UserMenuOverlay/UserMenuOverlay.tsx` — використовує всі три компоненти для відображення меню користувача

**Майбутнє використання:** Може використовуватися в бічному меню, профілі користувача тощо.

---

### `ScrollIndicator`

**Призначення:** Кастомний індикатор прокрутки (overlay), який замінює нативну полосу прокрутки.

**Особливості:**
- Не впливає на layout (`position: fixed`)
- Керується через CSS-змінні (`--si-*`)
- Автоматично ховається, якщо контент не потребує скроллу
- Підтримка `prefers-reduced-motion`

**Місця використання:**
- `app/Base.tsx` — глобальний індикатор прокрутки для всього сайту

**Майбутнє використання:** Залишається глобальним компонентом, який рендериться один раз у `Base.tsx`.

---

### `BookCommentsContainer`, `BookComments` (catalog/sections/)

**Призначення:** Секція коментарів на сторінці книги (або глави): завантаження списку, додавання коментаря/відповіді, лайк/дизлайк, лайк автора, видалення.

**Особливості:**
- **BookCommentsContainer** — контейнер з логікою: `useQuery` (fetchBookComments/fetchChapterComments за slug), `useMutation` (reaction, ownerLike, delete), валідація тексту (3–1000 символів), спам-захист (5 с), маппінг API → CommentItem; показ помилок через `useNotification().showError`; не показує success-тостів.
- **BookComments** — чистий UI: форма коментаря (controlled через props або внутрішній state), список CommentCard з відповідями, кнопками реакцій, лайком автора, кнопкою видалення (з станом «Видалення…» через `isDeletingId`).

**Місця використання:**
- `catalog/BookDetailOwner.tsx` — `<BookCommentsContainer type="book" slug={book.slug} isOwner />`
- `catalog/BookDetailReader.tsx` — `<BookCommentsContainer type="book" slug={book.slug} isOwner={false} />`

**Дані:** API через `api/reviewsApi.ts` (GET/POST/DELETE `/api/reviews/book|chapter/<slug>/comments/`, reaction, owner_like). Детально: docs/COMMENTS_FRONTEND.md.

---

### `ChapterDetailRouter`, `ChapterDetail` (catalog/)

**Призначення:** сторінка читання конкретної глави (`/books/:bookSlug/chapters/:chapterSlug`) з верхньою/нижньою навігацією, текстом глави та коментарями.

**Особливості:**
- `ChapterDetailRouter` завантажує:
  - chapter detail (`catalogApi.getChapterDetail`)
  - chapter navigation (`catalogApi.getChapterNavigation`)
- У переходах Prev/Next router спочатку prefetch-ить target chapter detail; при `403` відкриває локальну `Modal` з текстом backend.
- `isOwner` для сторінки глави визначається через `chapter.book_owner_id === userId` і передається в `BookCommentsContainer type="chapter"`.
- `ChapterDetail` — presentation-компонент: рендер Link-кнопок навігації, контенту (`dangerouslySetInnerHTML`) і секції коментарів.

**Місця використання:**
- `App.tsx` — маршрут `/books/:bookSlug/chapters/:chapterSlug` -> `ChapterDetailRouter`.
- `BookChapters.tsx` -> `onRead` веде на цей маршрут.

**Пов'язана документація:** `docs/CHAPTER_PAGE_DATA_FLOW.md`.

---

### `BookRatingStars` (catalog/sections/)

**Призначення:** Блок зіркового рейтингу (5 зірок) для книги: відображення середнього та кількості голосів, оцінка користувача; клік по зірці відправляє оцінку на бекенд.

**Особливості:**
- Використовується в `BookHero` двічі: РЕЙТИНГ ТВОРУ (BOOK) та ЯКІСТЬ ПЕРЕКЛАДУ (TRANSLATION). Дані (average, totalVotes, userRating) приходять з useQuery у BookHero (`ratingApi.fetchBookRatings(slug)`), не з полів book.
- Props: `bookSlug`, `ratingType` (BOOK | TRANSLATION), `title`, `average`, `totalVotes`, `userRating`, `isLoading`, `onRatingSuccess`.
- Три стани зірки: порожня (0), середня (0.5), заповнена (1); hover показує попередній вибір до кліку.
- Відправка оцінки: через `ratingApi.submitRating` з троттлінгом (`requestThrottle`); після успіху викликається `onRatingSuccess` (invalidate query у BookHero).
- Сповіщення: `useNotification()` — `showWarning` коли гость клікає зірку («Для голосування необхідно увійти в систему»); `showError` при помилці відправки (в т.ч. 429, повідомлення з `data.error` / `data.detail`). Див. NOTIFICATIONS_FRONTEND.md, RATINGS_FRONTEND.md.

**Місця використання:**
- `catalog/sections/BookHero.tsx` — два екземпляри з різними `ratingType` і даними з useQuery book-ratings.

---

### `Modal`

**Призначення:** Переиспользуемый компонент модального окна — оверлей + вікно з центруванням, доступністю, закриттям по Esc і overlay. Рендериться в **document.body** через `createPortal` (щоб бути поверх всього контенту).

**Файли:**
- `shared/Modal/Modal.tsx` — основний компонент
- `shared/Modal/Modal.module.css` — стилі оверлею, вікна, заголовка, контенту, кнопки закриття (×)

**Props:**
| Prop | Тип | Обов'язковий | Опис |
|------|-----|--------------|------|
| `open` | `boolean` | так | Чи відкрито модалку |
| `onClose` | `() => void` | так | Колбек закриття (викликається при Esc, клік по overlay, клік по ×) |
| `title` | `string` | ні | Заголовок (рендериться як `<h2 id="modal-title">`) |
| `children` | `React.ReactNode` | так | Вміст модалки (обгортається в `div` з класом `.content`) |
| `className` | `string` | ні | Додаткові CSS-класи для модального вікна (додаються до `.modal`) |
| `showCloseButton` | `boolean` | ні | Чи показувати кнопку закриття (×). За замовчуванням `true`. При `false` (наприклад у AutoCloseNotificationModal) крестик не рендериться. |

**Залежності:**
- `shared/hooks/useScrollLock.ts` — Modal викликає `useScrollLock(open)` для блокування скролу body при відкритті (iOS-safe)

**Поведінка:**
- Якщо `open === false` — повертає `null` (нічого не рендериться)
- Закриття: клік по overlay (`onClick={onClose}`), кнопка × (якщо `showCloseButton`), клавіша Escape
- Фокус: при відкритті фокус йде на перший focusable елемент у модалці; при закритті — повертається на попередній
- Доступність: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` при наявності title
- Анімації: `fadeIn` для overlay, `slideIn` для вікна; для `prefers-reduced-motion` — вимкнено

**Стилі (Modal.module.css):**
- `.overlay` — fixed, inset:0, напівпрозорий фон (rgba(0,0,0,0.7)), z-index: 2000
- `.modal` — fixed, центрування, max-width: min(90vw, 500px), max-height: 90vh, рамка cyan, box-shadow, scrollbar
- `.title` — заголовок (BadScript, clamp 20–28px)
- `.content` — flex column, gap для контенту

---

**Тип 1: Пряме використання `Modal`**

Місця і деталі:

1. **`users/Profile.tsx`** — 3 модалки:
   - **Поповнити баланс** (`depositModalOpen`): відкривається кнопкою «Поповнити баланс» (рядок ~494), закривається `onClose` і при успішному `depositMutation.onSuccess`. Вміст: форма з полем «Сума» і кнопкою «Поповнити», стилі з `Profile.module.css` (`.modalForm`, `.field`, `.input`, `.btnGreen`).
   - **Вивести кошти** (`withdrawModalOpen`): відкривається кнопкою «Вивести кошти» (рядок ~502), закривається `onClose` і при успішному `withdrawMutation.onSuccess`. Вміст: підказка «Доступно: {balance}», форма з полем «Сума» і кнопкою «Вивести», стилі `.modalForm`, `.modalHint`, `.btnRed`.
   - **Історія транзакцій** (`transactionModalOpen`): відкривається кнопкою «Історія транзакцій» (рядок ~471, `handleTransactionHistory`), закривається `onClose`. Вміст: список `balanceHistory` (`.transactionHistory`, `ul`/`li`).

   У всіх трьох: `className` не передається, використовуються тільки стандартні стилі Modal + локальні стилі сторінки.

2. **`widgets/header/UserMenuOverlay/UserMenuOverlay.tsx`** — 2 модалки:
   - **Вхід** (`loginModalOpen`): відкривається кнопкою «Вхід» (рядок ~188) — при кліку спочатку `setLoginModalOpen(true)`, потім `onClose()` закриває overlay меню. Закривається `onClose` і через `handleLoginSuccess` (після успішного логіну). Вміст: `<LoginForm onSuccess={handleLoginSuccess} />`.
   - **Реєстрація** (`registerModalOpen`): відкривається кнопкою «Реєстрація» (рядок ~197) — при кліку спочатку `setRegisterModalOpen(true)`, потім `onClose()` закриває overlay меню. Закривається `onClose` і через `handleRegisterSuccess`. Вміст: `<RegisterForm onSuccess={handleRegisterSuccess} />`.

   У обох: `className` не передається, title — «Вхід» і «Реєстрація».

---

**Тип 2: Використання через `NotificationModal` (обгортка над `Modal`)**

- **Файл:** `shared/NotificationModal/NotificationModal.tsx`
- **Призначення:** Модалка для уведомлень (error/success/info/warning) з фіксованим layout: заголовок за типом, текст повідомлення, кнопка «Зрозуміло».

**Props:**
- `open`, `onClose`, `message`, `type?: "error" | "success" | "info" | "warning"`

**Реалізація:** Викликає `<Modal open={open} onClose={onClose} title={getTitle()}>` з контентом: div з класами `.content` і `.[type]` (для кольорової смуги зліва), `<p>` з текстом, `<ActionButton>` «Зрозуміло» для закриття.

**Deployment:**
- `NotificationProvider` (`shared/NotificationModal/NotificationProvider.tsx`) зберігає state уведомлення (`open`, `message`, `type`, **`variant`**: `"default"` | `"autoClose"`). Залежно від variant рендерить або **NotificationModal**, або **AutoCloseNotificationModal**.
- Провайдер обгортає весь додаток у `App.tsx`.
- Уведомлення викликаються через `useNotification()`: `showError`, `showSuccess`, `showInfo`, `showWarning`, **`showSuccessAutoClose(message)`** — успіх без кнопок, модалка сама зникає через 3 с (константа `AUTO_CLOSE_MS` у провайдері).

**AutoCloseNotificationModal** (`shared/NotificationModal/AutoCloseNotificationModal.tsx`): використовує `Modal` з `showCloseButton={false}`; тільки заголовок «Успіх» і текст повідомлення; у `useEffect` таймер на `autoCloseMs` мс викликає `onClose()`. Використовується після успішного створення глави (редирект на сторінку книги → BookDetailRouter викликає `showSuccessAutoClose`).

**Місця використання `useNotification`:**
- `users/Profile.tsx` — `showSuccess`, `showError` (результати мутацій)
- `auth/LoginForm.tsx`, `auth/RegisterForm.tsx` — показ помилок
- `catalog/BookDetailRouter.tsx` — `showSuccessAutoClose("Глава успішно завантажена")` при `location.state?.chapterCreated`
- `catalog/AddChapter.tsx` — `showError` (помилки доступу та валідації)

**Стилі:** `NotificationModal.module.css` — `.content`, `.message`, `.actions`, `.error` / `.success` / `.info` / `.warning` (border-left для кольорового акценту). AutoCloseNotificationModal використовує ті самі класи для контенту.

---

**Підсумок:**
- Один базовий компонент: `Modal` (shared/Modal), опційно `showCloseButton`.
- Використання: напряму (Profile, UserMenuOverlay); через `NotificationModal` (глобальні уведомлення з кнопкою «Зрозуміло» та ×); через `AutoCloseNotificationModal` (успіх після створення глави — без кнопок, авто-закриття через 3 с).

**Майбутнє використання:** Для будь-якої нової модалки імпортувати `Modal` з `shared/Modal/Modal`, передати `open`, `onClose`, опційно `title` і `className`, і передати вміст як `children`.

---

## `widgets/` — Великі переиспользуемые секції

### `Header`

**Призначення:** Хедер сайту з логотипом, навігацією, блоком користувача та бургер-меню.

**Використовує компоненти:**
- `Container` — для обгортки контенту
- `Icon` — для іконок (пошук, бургер, шеврон)
- `FrameLink` — для навігаційних посилань
- `UserMenuOverlay` — для меню користувача

**Місця використання:**
- `app/Base.tsx` — рендериться на всіх сторінках через макет

---

### `Footer`

**Призначення:** Футер сайту з посиланнями, соціальними мережами та інформацією.

**Використовує компоненти:**
- `Container` — для обгортки контенту
- `Icon` — для іконок соцмереж (Facebook, Instagram, YouTube)

**Місця використання:**
- `app/Base.tsx` — рендериться на всіх сторінках через макет

---

## Правила використання

1. **Не дублюйте код:** Якщо компонент вже існує в `shared/` або `widgets/`, використовуйте його замість створення нового.

2. **Оновлюйте документацію:** При додаванні нового місця використання компонента оновіть цей файл.

3. **Стилі:** Більшість компонентів використовують CSS Modules для ізоляції стилів, але в проєкті є й звичайні `.css` (наприклад, `BookCard/BookCard.css`, `catalog/AbandonedTranslations.css`).

4. **TypeScript:** Всі компоненти типізовані через TypeScript для безпеки типів.

5. **Доступність:** Компоненти підтримують `aria-label`, `aria-hidden` та інші атрибути доступності.

---

## Майбутні компоненти

При створенні нових переиспользуемых компонентів додавайте їх до цього документа з описом:
- Призначення
- Особливості
- Місця використання
- Приклад використання

---

**Останнє оновлення:** 2026-02-22
