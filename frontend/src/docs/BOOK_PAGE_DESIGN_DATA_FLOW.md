# Дизайн и данные страницы книги (Frontend)

Документ описывает, как данные книги превращаются в UI на `/books/:slug`.  
Отдельная страница главы описана в `CHAPTER_PAGE_DATA_FLOW.md`.

---

## 1) Компонентная схема

```text
BookDetailRouter
  -> BookDetailOwner | BookDetailReader
      -> BookDetailLayout
          -> hero         (BookHero)
          -> description  (BookDescription)
          -> extraImages  (BookExtraImages, якщо є дані)
          -> authorWorks  (AuthorWorks → BookScrollerCarousel)
          -> subscription (SubscriptionPurchaseBlock, тільки reader)
          -> chapters     (BookChapters)
          -> comments     (BookCommentsContainer -> BookComments)
```

---

## 2) Что готовят Owner/Reader

`BookDetailOwner` и `BookDetailReader`:
- собирают `metaRows` из данных `book`;
- вычисляют `description`;
- задают callbacks для `BookChapters` (`onRead`, owner-кнопки, формат цены и даты);
- передают `bookSlug` в `BookHero` для рейтингов.

`BookDetailLayout` не работает с API напрямую, только размещает блоки.

`BookDetailOwner` и `BookDetailReader` передают `<AuthorWorks bookSlug={book.slug} />` в слот `authorWorks`.

---

## 3) Блок authorWorks — «ІНШІ РОБОТИ АВТОРА»

`AuthorWorks.tsx`:
- окремий `useQuery` (`catalogKeys.authorOtherWorks`, `getAuthorOtherWorks`);
- не чекає на дані основної книги окрім `bookSlug`;
- при `isPending`, `isError` або `books.length === 0` повертає `null` (секція не займає місце);
- рендерить заголовок з декоративною лінією і `BookScrollerCarousel` з `BookCard variant="carousel"`.

**Відбір книг (бекенд):** той самий `owner`, що й у поточної книги (не `creator`); поточна книга виключена; лише з обкладинкою та slug; перевірка `view`-доступу. Деталі: **LISTS_AND_CAROUSELS_FRONTEND.md** §2, **LISTS_AND_CAROUSELS_BACKEND.md** §3.

**Навігація каруселі:** стрілки, зірки, свайп на сенсорі, **перетягування мишкою** на ПК (drag блокує випадковий клік по картці). Автопрокрутка **вимкнена** (на відміну від реклами). Див. **LISTS_AND_CAROUSELS_FRONTEND.md** §1.3, §2.

**Стилі:** `BookDetail.module.css` (`.authorWorks*`), `BookCard.css` (`.bookCard--carousel`, `BookCardTitle`).

---

## 4) Блок chapters: фактическое поведение

`BookChapters.tsx`:
- получает `bookId` и сам загружает текущую «страницу» глав через `getPaginatedChapters(bookId, rangeStart)`;
- при >50 главах показывает `ChapterRangeNavigation` («Показано розділів:» + pill `1-50` + «з N»);
- в режиме reorder владелец передает override `chapters={...}` — пагинация и селектор скрыты;
- рендерит таблицу с названием, ценой, датой;
- owner-кнопки (`Додати розділ`, `Створити том`, `Змінити порядок`) показывает только при `isOwner`;
- и кнопка в строке, и клик по названию используют один `onRead(chapter)`.

Детали пагинации: `CHAPTER_PAGINATION_FRONTEND.md`.

Нюанс reader-режима:
- в `BookDetailReader` `getReadLabel` показывает `Купити` для `is_paid && !is_purchased`;
- `handleChapterClick` в `BookChapters`: при наличии активного prepaid-пакета — сначала `purchaseChapter`, затем `navigate`; иначе — сразу `navigate`.

---

## 5) Hero и рейтинги

`BookHero` получает основные пропсы из owner/reader:
- `title`, `titleSecondary`, `coverImageUrl`, `showAgeBadge`, `authorMarkText`, `metaRows`.

Рейтинги в Hero:
- не берутся из `book.ratingValue/book.ratingCount`;
- грузятся отдельным запросом через `ratingApi.fetchBookRatings(bookSlug)`;
- рендерятся двумя экземплярами `BookRatingStars` (BOOK и TRANSLATION).

---

## 6) Комментарии

`BookCommentsContainer`:
- для страницы книги работает с `type="book"` и `slug={book.slug}`;
- сам выполняет запросы и мутации комментариев;
- в UI передает нормализованный список и callbacks в `BookComments`.

---

## 7) Где начинается страница главы

Переход в главу идет из блока `BookChapters` через `onRead`.  
Дальше работу берет `ChapterDetailRouter` (см. `CHAPTER_PAGE_DATA_FLOW.md`).

---

*Останнє оновлення: 2026-06-28 (`AuthorWorks`, `BookScrollerCarousel`, без автопрокрутки).*
