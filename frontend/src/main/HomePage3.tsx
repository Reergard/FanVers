import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookCard } from "../BookCard/BookCard";
import type { BookCardBook } from "../BookCard/BookCard";
import { SectionLineTitle } from "../navigation/SectionLineTitle";
import { ShowMoreNavigation } from "../navigation/ShowMoreNavigation";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import {
  getBooksRecentUpdates,
  getBookNewsCoverUrl,
  getRecentUpdateCardCaption,
  type BookRecentUpdateItem,
} from "../api/mainApi";
import "./HomePage.module.css";

/** Як у каталозі (`Catalog.tsx` → PAGE_SIZE). */
const PAGE_SIZE = 8;

const BOOKS_RECENT_STALE_MS = 5 * 60 * 1000;

function toBookCardBook(book: BookRecentUpdateItem): BookCardBook {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    image: book.image,
    adult_content: book.adult_content,
    book_type: book.book_type,
    is_new_badge: book.is_new_badge,
    created_at: book.created_at,
  };
}

export function HomePage3() {
  const { data: books = [], isLoading, isError } = useQuery({
    queryKey: ["books-recent-updates-homepage-3"],
    queryFn: getBooksRecentUpdates,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: BOOKS_RECENT_STALE_MS,
  });

  const booksLength = books.length;
  const [visibleCap, setVisibleCap] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCap(PAGE_SIZE);
  }, [booksLength]);

  const displayedBooks = useMemo(
    () => books.slice(0, Math.min(visibleCap, booksLength)),
    [books, visibleCap, booksLength]
  );

  const shownCount = Math.min(visibleCap, booksLength);

  if (isLoading) {
    return (
      <section className="mg2-section" aria-label="Останні оновлення">
        <SectionLineTitle text="ОСТАННІ ОНОВЛЕННЯ" className="mg2-sectionLineTitle" />
        <p className="mg2-placeholder">Завантаження оновлень…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="mg2-section" aria-label="Останні оновлення">
        <SectionLineTitle text="ОСТАННІ ОНОВЛЕННЯ" className="mg2-sectionLineTitle" />
        <p className="mg2-placeholder">
          Не вдалося завантажити оновлення. Спробуйте пізніше.
        </p>
      </section>
    );
  }

  if (booksLength === 0) {
    return (
      <section className="mg2-section" aria-label="Останні оновлення">
        <SectionLineTitle text="ОСТАННІ ОНОВЛЕННЯ" className="mg2-sectionLineTitle" />
        <p className="mg2-placeholder">Нещодавніх оновлень глав поки немає</p>
      </section>
    );
  }

  return (
    <section className="mg2-section" aria-label="Останні оновлення">
      <SectionLineTitle text="ОСТАННІ ОНОВЛЕННЯ" className="mg2-sectionLineTitle" />

      <div className="mg2-grid">
        {displayedBooks.map((book) => {
          const coverUrl = getBookNewsCoverUrl(book);
          const bookCardBook = toBookCardBook(book);
          const caption = getRecentUpdateCardCaption(book);

          return (
            <article key={book.id} className="mg2-cardShell">
              <BookCard
                book={{
                  ...bookCardBook,
                  image: coverUrl,
                }}
              />
              <p className="mg2-description">{caption}</p>
              <ActionButton
                to={book.slug ? `/books/${book.slug}` : "#"}
                variant="default"
                size="sm"
                className="mg2-readBtn"
                ariaLabel={`Читати: ${book.title}`}
              >
                Читати
              </ActionButton>
            </article>
          );
        })}
      </div>

      <ShowMoreNavigation
        className="mg2-showMoreNav"
        visibleCount={shownCount}
        totalCount={booksLength}
        onShowMore={() =>
          setVisibleCap((prev) => Math.min(prev + PAGE_SIZE, booksLength))
        }
        ariaLabel="Показати ще оновлення"
      />
    </section>
  );
}

export default HomePage3;
