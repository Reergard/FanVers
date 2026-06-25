import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import styles from "./components/BookForm/BookForm.module.css";
import { Container } from "../shared/Container";
import { RequireAuth } from "../auth/RequireAuth";
import { useAuth } from "../auth/useAuth";
import { getMyProfile } from "../users/profileService";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import {
  createBook,
  type CreateBookPayload,
} from "../api/catalogApi";
import { uploadNewBookExtraImages } from "./components/BookForm/bookFormExtraImages.utils";
import { BookForm, initialFormData } from "./components/BookForm/BookForm";
import { useBookFormMeta } from "./hooks/useBookFormMeta";
import { Breadcrumb } from "../navigation/Breadcrumb";
import { profileQueryKey } from "../shared/queryKeys";
import { PageTitle } from "../navigation/PageTitle";

function CreateBookPageInner() {
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const { isAuthenticated, role: authRole, userId } = useAuth();
  const profileQuery = useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: getMyProfile,
    enabled: isAuthenticated,
  });
  const bookCreationProfileRole = profileQuery.data?.role ?? authRole ?? null;
  const meta = useBookFormMeta();

  const createBookMutation = useMutation({
    mutationFn: async ({
      payload,
      extraImages,
    }: {
      payload: CreateBookPayload;
      extraImages: Parameters<typeof uploadNewBookExtraImages>[1];
    }) => {
      const book = await createBook(payload);
      await uploadNewBookExtraImages(book.slug, extraImages);
      return book;
    },
    onSuccess: () => {
      showSuccess("Книга успішно створена!");
      navigate("/my-translations");
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { status: number; data?: { message?: string; details?: Record<string, string> } }; message?: string };
      const status = ax.response?.status;
      const data = ax.response?.data;
      const msg =
        data?.message ||
        (data?.details && Object.values(data.details).length > 0 ? Object.values(data.details).join(". ") : null) ||
        ax.message ||
        "Помилка при створенні книги";
      if (status === 401) showError("Необхідна авторизація. Увійдіть знову.");
      else if (status === 403) showError("У вас немає прав для створення книг.");
      else showError(msg);
    },
  });

  const isSubmitting = createBookMutation.isPending;

  if (meta.isLoading) {
    return (
      <Container>
        <section className={styles.page} aria-label="Створення книги">
          <header className={styles.top}>
            <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Створення" }]} />
            <PageTitle>Створення</PageTitle>
          </header>
          <div style={{ textAlign: "center", padding: "48px 16px", color: "rgba(255,255,255,0.8)" }}>
            Завантаження даних…
          </div>
        </section>
      </Container>
    );
  }

  return (
    <Container>
      <section className={styles.page} aria-label="Створення книги">
        <header className={styles.top}>
          <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Створення" }]} />
          <PageTitle>Створення</PageTitle>
        </header>

        <BookForm
          mode="create"
          initialValues={initialFormData}
          initialImagePreview={null}
          meta={meta}
          submitLabel="Опублікувати переклад"
          submitting={isSubmitting}
          onError={showError}
          onSubmit={(payload, { extraImages }) =>
            createBookMutation.mutate({
              payload: payload as CreateBookPayload,
              extraImages,
            })
          }
          bookCreationProfileRole={bookCreationProfileRole}
          bookCreationProfileLoading={profileQuery.isLoading}
        />
      </section>
    </Container>
  );
}

export function CreateBookPage() {
  return (
    <RequireAuth>
      <CreateBookPageInner />
    </RequireAuth>
  );
}
