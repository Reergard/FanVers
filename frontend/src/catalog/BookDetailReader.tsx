import { useMemo } from "react";
import { useAuth } from "../auth/useAuth";
import type { Book, Chapter, Volume } from "../api/catalogApi";
import { BookDetailLayout } from "./BookDetailLayout";
import { BookHero } from "./sections/BookHero";
import { BookDescription } from "./sections/BookDescription";
import { AuthorWorks } from "./sections/AuthorWorks";
import { BookChapters } from "./sections/BookChapters";
import { BookComments } from "./sections/BookComments";

interface BookDetailReaderProps {
  book: Book;
  volumes: Volume[];
  chapters: Chapter[];
}

export default function BookDetailReader({
  book,
  volumes,
  chapters,
}: BookDetailReaderProps) {
  const { isAuthenticated } = useAuth();

  const metaRows = useMemo(
    () => [
      { label: "Автор:", value: "—" },
      { label: "Перекладач:", value: "—" },
      { label: "Розділів:", value: String(book.chapters_count ?? chapters.length) },
      { label: "Жанр:", value: "—" },
      { label: "Теги:", value: "—" },
      { label: "Фендом:", value: "—" },
      { label: "Країна:", value: "—" },
      { label: "Статус перекладу:", value: book.isPublic ? "Публічна" : "Перекладається" },
      { label: "Статус випуску твору:", value: "Виходить" },
    ],
    [book.chapters_count, book.isPublic, chapters.length]
  );

  const description = (book as Book & { description?: string }).description ?? null;

  return (
    <BookDetailLayout
      hero={
        <BookHero
          title={book.title}
          titleSecondary={(book as Book & { titleSecondary?: string }).titleSecondary ?? undefined}
          coverImageUrl={(book as Book & { coverImageUrl?: string }).coverImageUrl ?? null}
          showAgeBadge={(book as Book & { ageRestriction?: boolean }).ageRestriction ?? false}
          authorMarkText={(book as Book & { authorMark?: string }).authorMark ?? "Авторська книга"}
          metaRows={metaRows}
          ratingValue={(book as Book & { ratingValue?: number }).ratingValue ?? null}
          ratingCount={(book as Book & { ratingCount?: number }).ratingCount ?? null}
          thankAuthorCoins={(book as Book & { thankAuthorCoins?: number }).thankAuthorCoins ?? 10}
          onBecomeTranslator={isAuthenticated ? () => {} : undefined}
        />
      }
      description={<BookDescription description={description} />}
      authorWorks={<AuthorWorks />}
      chapters={
        <BookChapters
          chapters={chapters}
          isOwner={false}
          onRead={(ch) => {
            /* TODO: navigate to chapter */
          }}
          getChapterPrice={() => "10 ₴"}
          getChapterDate={() => "13.02.2023"}
        />
      }
      comments={<BookComments comments={[]} />}
    />
  );
}
