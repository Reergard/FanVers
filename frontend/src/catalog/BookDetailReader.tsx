import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { catalogKeys } from "../api/catalogApi";
import type { Book, Chapter, Volume } from "../api/catalogApi";
import { resolveBookCoverUrl } from "../shared/bookCover/resolveBookCoverUrl";
import { BookDetailLayout } from "./BookDetailLayout";
import { BookHero } from "./sections/BookHero";
import { BookDescription } from "./sections/BookDescription";
import { AuthorWorks } from "./sections/AuthorWorks";
import { BookChapters } from "./sections/BookChapters";
import { BookCommentsContainer } from "./sections/BookCommentsContainer";
import { SubscriptionPurchaseBlock } from "./sections/SubscriptionPurchaseBlock";

interface BookDetailReaderProps {
  book: Book;
  volumes: Volume[];
  chapters: Chapter[];
  chaptersLoading?: boolean;
  volumesLoading?: boolean;
}

export default function BookDetailReader({
  book,
  volumes,
  chapters,
  chaptersLoading = false,
  volumesLoading: _volumesLoading,
}: BookDetailReaderProps) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const metaRows = useMemo(() => {
    const publicationLabel =
      book.book_type === "AUTHOR" ? "Статус публікації:" : "Статус перекладу:";
    const publicationPermissionLabel =
      book.view_permission === "all"
        ? "Публічна"
        : book.view_permission === "bookmarked"
          ? "Для закладок"
          : book.view_permission === "none"
            ? "Приватна"
            : "—";
    const publicationValue =
      book.book_type === "AUTHOR"
        ? publicationPermissionLabel
        : book.translation_status_display ?? "Перекладається";

    return [
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
      {
        label: publicationLabel,
        value: publicationValue,
      },
      { label: "Країна:", value: book.country?.name ?? "—" },
      {
        label: "Статус випуску твору:",
        value: book.original_status_display ?? "Виходить",
      },
    ];
  }, [
    book.author,
    book.book_type,
    book.creator_username,
    book.chapters_count,
    chapters.length,
    book.genres,
    book.tags,
    book.fandoms,
    book.country,
    book.translation_status_display,
    book.original_status_display,
    book.view_permission,
  ]);

  const authorMarkText =
    book.book_type === "AUTHOR" ? "Авторська книга" : book.book_type === "TRANSLATION" ? null : null;

  const description = book.description ?? null;

  return (
    <BookDetailLayout
      breadcrumbItems={[
        { label: "Головна", to: "/" },
        { label: book.title },
      ]}
      hero={
        <BookHero
          title={book.title}
          titleSecondary={book.titleSecondary ?? undefined}
          coverImageUrl={book.image ? resolveBookCoverUrl(book.image) : null}
          showAgeBadge={book.adult_content === true}
          authorMarkText={authorMarkText ?? undefined}
          metaRows={metaRows}
          bookSlug={book.slug}
          bookType={book.book_type ?? undefined}
          ratingValue={book.ratingValue ?? null}
          ratingCount={book.ratingCount ?? null}
          thankAuthorCoins={book.thankAuthorCoins ?? 20}
          bookId={book.id}
          thankAuthorLabel={
            book.book_type === "TRANSLATION" ? "Подякувати перекладачу" : "Подякувати автору"
          }
          thankAuthorInteractive={true}
          showSettings={false}
          onBecomeTranslator={isAuthenticated ? () => {} : undefined}
        />
      }
      description={<BookDescription description={description} />}
      authorWorks={<AuthorWorks />}
      subscription={
        <SubscriptionPurchaseBlock
          bookSlug={book.slug}
          onPurchaseSuccess={() => {
            queryClient.invalidateQueries({ queryKey: catalogKeys.chapters(book.slug) });
            queryClient.invalidateQueries({ queryKey: catalogKeys.book(book.slug) });
          }}
        />
      }
      chapters={
        <BookChapters
          chapters={chapters}
          volumes={volumes}
          isOwner={false}
          bookSlug={book.slug}
          requireAuthForPurchase
          onPurchaseSuccess={() => {
            queryClient.invalidateQueries({ queryKey: catalogKeys.chapters(book.slug) });
            queryClient.invalidateQueries({ queryKey: catalogKeys.book(book.slug) });
          }}
          loading={chaptersLoading}
          onRead={(ch) => navigate(`/books/${book.slug}/chapters/${ch.slug ?? ch.id}`)}
          getReadLabel={(ch) => (ch.is_paid && !ch.is_purchased ? "Купити" : "Читати")}
          getChapterPrice={(ch) =>
            ch.is_paid && ch.price != null && ch.price > 0
              ? `${Number(ch.price).toFixed(2)} FanCoins`
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
