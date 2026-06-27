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
          -> authorWorks  (AuthorWorks)
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

---

## 3) Блок chapters: фактическое поведение

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

## 4) Hero и рейтинги

`BookHero` получает основные пропсы из owner/reader:
- `title`, `titleSecondary`, `coverImageUrl`, `showAgeBadge`, `authorMarkText`, `metaRows`.

Рейтинги в Hero:
- не берутся из `book.ratingValue/book.ratingCount`;
- грузятся отдельным запросом через `ratingApi.fetchBookRatings(bookSlug)`;
- рендерятся двумя экземплярами `BookRatingStars` (BOOK и TRANSLATION).

---

## 5) Комментарии

`BookCommentsContainer`:
- для страницы книги работает с `type="book"` и `slug={book.slug}`;
- сам выполняет запросы и мутации комментариев;
- в UI передает нормализованный список и callbacks в `BookComments`.

---

## 6) Где начинается страница главы

Переход в главу идет из блока `BookChapters` через `onRead`.  
Дальше работу берет `ChapterDetailRouter` (см. `CHAPTER_PAGE_DATA_FLOW.md`).
