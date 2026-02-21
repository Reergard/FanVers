import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import type { Book, Chapter, Volume } from "../api/catalogApi";
import { BookDetailLayout } from "./BookDetailLayout";
import { BookHero } from "./sections/BookHero";
import { BookDescription } from "./sections/BookDescription";
import { AuthorWorks } from "./sections/AuthorWorks";
import { BookChapters } from "./sections/BookChapters";
import { BookCommentsContainer } from "./sections/BookCommentsContainer";

interface BookDetailReaderProps {
  book: Book;
  volumes: Volume[];
  chapters: Chapter[];
  chaptersLoading?: boolean;
  volumesLoading?: boolean;
}

export default function BookDetailReader({
  book,
  volumes: _volumes,
  chapters,
  chaptersLoading = false,
  volumesLoading: _volumesLoading,
}: BookDetailReaderProps) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

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
          bookSlug={book.slug}
          ratingValue={book.ratingValue ?? null}
          ratingCount={book.ratingCount ?? null}
          thankAuthorCoins={book.thankAuthorCoins ?? 10}
          bookId={book.id}
          onBecomeTranslator={isAuthenticated ? () => {} : undefined}
        />
      }
      description={<BookDescription description={description} />}
      authorWorks={<AuthorWorks />}
      chapters={
        <BookChapters
          chapters={chapters}
          isOwner={false}
          loading={chaptersLoading}
          onRead={(ch) => navigate(`/books/${book.slug}/chapters/${ch.slug ?? ch.id}`)}
          getReadLabel={(ch) => (ch.is_paid && !ch.is_purchased ? "Купити" : "Читати")}
          getChapterPrice={(ch) =>
            ch.is_paid && ch.price != null && ch.price > 0
              ? `${Number(ch.price).toFixed(2)} ₴`
              : "Безкоштовно"
          }
          getChapterDate={(ch) =>
            ch.created_at
              ? new Date(ch.created_at).toLocaleDateString("uk-UA", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })
              : "—"
          }
        />
      }
      comments={<BookCommentsContainer type="book" slug={book.slug} isOwner={false} />}
    />
  );
}
