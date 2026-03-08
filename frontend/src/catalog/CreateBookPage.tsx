import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import styles from "./components/BookForm/BookForm.module.css";
import { Container } from "../shared/Container";
import { RequireAuth } from "../auth/RequireAuth";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import {
  createBook,
  type CreateBookPayload,
} from "../api/catalogApi";
import { BookForm, initialFormData } from "./components/BookForm/BookForm";
import { useBookFormMeta } from "./hooks/useBookFormMeta";
import { Breadcrumb } from "../navigation/Breadcrumb";

function CreateBookPageInner() {
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const meta = useBookFormMeta();

  const createBookMutation = useMutation({
    mutationFn: (payload: CreateBookPayload) => createBook(payload),
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
            <h1 className={styles.h1}>Створення</h1>
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
          <h1 className={styles.h1}>Створення</h1>
        </header>

        <BookForm
          mode="create"
          initialValues={initialFormData}
          initialImagePreview={null}
          meta={meta}
          submitLabel="Опублікувати переклад"
          submitting={isSubmitting}
          onError={showError}
          onSubmit={(payload) => createBookMutation.mutate(payload as CreateBookPayload)}
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
