import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookCard } from "../BookCard/BookCard";
import type { BookCardBook } from "../BookCard/BookCard";
import { SectionLineTitle } from "../navigation/SectionLineTitle";
import { ShowMoreNavigation } from "../navigation/ShowMoreNavigation";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { Container } from "../shared/Container";
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

function HomeUpdatesSection({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section className="mg2-section" aria-label="Останні оновлення">
      <Container>{children}</Container>
    </section>
  );
}

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
    genres: book.genres,
    tags: book.tags,
    fandoms: book.fandoms,
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
      <HomeUpdatesSection>
        <SectionLineTitle text="ОСТАННІ ОНОВЛЕННЯ" className="mg2-sectionLineTitle" />
        <p className="mg2-placeholder">Завантаження оновлень…</p>
      </HomeUpdatesSection>
    );
  }

  if (isError) {
    return (
      <HomeUpdatesSection>
        <SectionLineTitle text="ОСТАННІ ОНОВЛЕННЯ" className="mg2-sectionLineTitle" />
        <p className="mg2-placeholder">
          Не вдалося завантажити оновлення. Спробуйте пізніше.
        </p>
      </HomeUpdatesSection>
    );
  }

  if (booksLength === 0) {
    return (
      <HomeUpdatesSection>
        <SectionLineTitle text="ОСТАННІ ОНОВЛЕННЯ" className="mg2-sectionLineTitle" />
        <p className="mg2-placeholder">Нещодавніх оновлень глав поки немає</p>
      </HomeUpdatesSection>
    );
  }

  return (
    <HomeUpdatesSection>
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
                variant="withTags"
                hideFooter
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
    </HomeUpdatesSection>
  );
}

export default HomePage3;
