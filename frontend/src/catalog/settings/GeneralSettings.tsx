import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useNotification } from "../../shared/NotificationModal/NotificationProvider";
import { useAuth } from "../../auth/useAuth";
import { catalogKeys, type UpdateBookPayload } from "../../api/catalogApi";
import { resolveBookCoverUrl } from "../../shared/bookCover/resolveBookCoverUrl";
import { BookForm, initialFormData, type BookFormData } from "../components/BookForm/BookForm";
import { useBookBySlug } from "../hooks/useBookBySlug";
import { useBookUpdate } from "../hooks/useBookUpdate";
import { useBookFormMeta } from "../hooks/useBookFormMeta";

function toOriginalStatus(raw?: string | null): string {
  if (!raw) return "";
  if (raw === "ONGOING" || raw === "STOPPED" || raw === "COMPLETED") return raw;
  if (raw === "Виходить") return "ONGOING";
  if (raw === "Припинено") return "STOPPED";
  if (raw === "Завершено" || raw === "Завершений") return "COMPLETED";
  return "";
}

function toId(x: { id?: number } | number): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  const id = (x as { id?: number })?.id;
  return id != null && Number.isFinite(id) ? id : null;
}

function toTranslationStatus(raw?: string | null): string {
  if (!raw) return "TRANSLATING";
  if (raw === "TRANSLATING" || raw === "WAITING" || raw === "COMPLETED" || raw === "PAUSED" || raw === "ABANDONED") return raw;
  if (raw === "Перекладається") return "TRANSLATING";
  if (raw === "В очікуванні розділів") return "WAITING";
  if (raw === "Завершено") return "COMPLETED";
  if (raw === "Перерва") return "PAUSED";
  if (raw === "Покинутий") return "ABANDONED";
  return "TRANSLATING";
}

export default function GeneralSettings() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useNotification();
  const { userId } = useAuth();
  const meta = useBookFormMeta();
  const { data: book, isLoading } = useBookBySlug(slug);
  const updateBookMutation = useBookUpdate(slug);

  const initialValues = useMemo<BookFormData>(() => {
    if (!book) return initialFormData;
    const bookType = book.book_type === "AUTHOR" ? "AUTHOR" : "TRANSLATION";
    return {
      title: book.title ?? "",
      title_en: book.title_en ?? "",
      author: book.author ?? "",
      description: book.description ?? "",
      book_type: bookType,
      translation_status: toTranslationStatus(book.translation_status ?? book.translation_status_display),
      original_status: toOriginalStatus(book.original_status ?? book.original_status_display),
      country: book.country?.id != null ? String(book.country.id) : "",
      genres: (book.genres ?? []).map(toId).filter((id): id is number => id != null),
      tags: (book.tags ?? []).map(toId).filter((id): id is number => id != null),
      fandoms: (book.fandoms ?? []).map(toId).filter((id): id is number => id != null),
      adult_content: book.adult_content === true,
      image: null,
    };
  }, [book]);

  if (!slug) return null;

  if (isLoading || meta.isLoading) {
    return <div style={{ textAlign: "center", padding: "32px 16px" }}>Завантаження…</div>;
  }

  if (!book) {
    return <div style={{ textAlign: "center", padding: "32px 16px" }}>Книгу не знайдено</div>;
  }

  return (
    <BookForm
      mode="update"
      initialValues={initialValues}
      initialImagePreview={book.image ? resolveBookCoverUrl(book.image) : null}
      meta={meta}
      submitLabel="Зберегти зміни"
      submitting={updateBookMutation.isPending}
      onError={showError}
      onSubmit={(payload) => {
        if (userId == null || book.owner !== userId) {
          showError("У вас немає прав для редагування цієї книги");
          navigate(`/books/${slug}`, { replace: true });
          return;
        }

        updateBookMutation.mutate(payload as UpdateBookPayload, {
          onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: catalogKeys.book(slug) });
            showSuccess("Налаштування книги оновлено");
            window.scrollTo(0, 0);
            navigate(`/books/${slug}`);
          },
          onError: (err: unknown) => {
            const message =
              err && typeof err === "object" && "message" in err
                ? String((err as { message: unknown }).message)
                : "Не вдалося оновити книгу";
            showError(message);
          },
        });
      }}
    />
  );
}
