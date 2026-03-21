import { useMemo } from "react";
import { BookCard } from "../BookCard/BookCard";
import type { BookCardBook } from "../BookCard/BookCard";
import { SectionLineTitle } from "../navigation/SectionLineTitle";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { resolveBookCoverUrl } from "../shared/bookCover/resolveBookCoverUrl";

const STUB_DESCRIPTION =
  "Незабаром тут з’явиться підбірка. Логіку топу підключимо пізніше.";

/** Заглушки; пізніше замінити на дані з власного API/запиту для ТОПу. */
function getTopStubBooks(): BookCardBook[] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: 13_000 + i,
    slug: "",
    title: `Топ · ${i + 1}`,
    owner: 0,
    adult_content: false,
    image: null,
  }));
}

export function MagicalGuide3() {
  const books = useMemo(() => getTopStubBooks(), []);

  return (
    <section className="mg2-section" aria-label="Топ">
      <SectionLineTitle text="ТОП" className="mg2-sectionLineTitle" />

      <div className="mg2-grid">
        {books.map((book) => {
          const coverUrl = resolveBookCoverUrl(book.image);
          return (
            <article key={book.id} className="mg2-cardShell">
              <BookCard book={{ ...book, image: coverUrl }} />
              <p className="mg2-description">{STUB_DESCRIPTION}</p>
              <ActionButton
                to="#"
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
    </section>
  );
}

export default MagicalGuide3;
