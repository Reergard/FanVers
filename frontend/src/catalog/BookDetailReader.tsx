import { useMemo } from "react";
import { useAuth } from "../auth/useAuth";
import type { Book, Chapter, Volume } from "../api/catalogApi";
import { BookDetailLayout } from "./BookDetailLayout";
import { BookHero } from "./sections/BookHero";
import { BookDescription } from "./sections/BookDescription";
import { AuthorWorks } from "./sections/AuthorWorks";
import { BookChapters } from "./sections/BookChapters";
import { BookComments, MOCK_COMMENTS } from "./sections/BookComments";

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
      { label: "Автор:", value: book.author ?? "—" },
      { label: "Перекладач:", value: book.creator_username ?? "—" },
      { label: "Розділів:", value: String(book.chapters_count ?? chapters.length) },
      {
        label: "Жанр:",
        value: book.genres?.length ? book.genres.map((g) => g.name).join(", ") : "—",
      },
      {
        label: "Теги:",
        value: book.tags?.length ? book.tags.map((t) => t.name).join(", ") : "—",
      },
      {
        label: "Фендом:",
        value: book.fandoms?.length ? book.fandoms.map((f) => f.name).join(", ") : "—",
      },
      { label: "Країна:", value: book.country?.name ?? "—" },
      {
        label: "Статус перекладу:",
        value: book.translation_status_display ?? (book.isPublic ? "Публічна" : "Перекладається"),
      },
      {
        label: "Статус випуску твору:",
        value: book.original_status_display ?? "Виходить",
      },
    ],
    [
      book.author,
      book.creator_username,
      book.chapters_count,
      chapters.length,
      book.genres,
      book.tags,
      book.fandoms,
      book.country,
      book.translation_status_display,
      book.original_status_display,
      book.isPublic,
    ]
  );

  const authorMarkText =
    book.book_type === "AUTHOR" ? "Авторська книга" : book.book_type === "TRANSLATION" ? null : null;

  const description = book.description ?? null;

  return (
    <BookDetailLayout
      hero={
        <BookHero
          title={book.title}
          titleSecondary={book.titleSecondary ?? undefined}
          coverImageUrl={book.image ?? null}
          showAgeBadge={book.adult_content === true}
          authorMarkText={authorMarkText ?? undefined}
          metaRows={metaRows}
          ratingValue={book.ratingValue ?? null}
          ratingCount={book.ratingCount ?? null}
          thankAuthorCoins={book.thankAuthorCoins ?? 10}
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
      comments={<BookComments comments={MOCK_COMMENTS} />}
    />
  );
}
