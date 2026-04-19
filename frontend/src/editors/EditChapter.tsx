import { useState, useLayoutEffect, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { editorsApi, type ChapterForEdit } from "../api/editorsApi";
import { getAccess } from "../auth/token";
import { authStore } from "../auth/store";
import { LazyChapterEditor } from "./components/LazyChapterEditor";
import { catalogApi, catalogKeys } from "../api/catalogApi";
import type { Volume } from "../api/catalogApi";
import { useAuth } from "../auth/useAuth";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { Container } from "../shared/Container";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { FilterCheckbox } from "../shared/FilterCheckbox/FilterCheckbox";
import styles from "./styles/EditChapter.module.css";
import { Breadcrumb } from "../navigation/Breadcrumb";
import { PageTitle } from "../navigation/PageTitle";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isDocxFile(file: File): boolean {
  const type = file.type?.toLowerCase() || "";
  const name = (file.name || "").toLowerCase();
  return (
    type === DOCX_MIME ||
    name.endsWith(".docx") ||
    (type === "" && name.endsWith(".docx"))
  );
}

function UploadCloudIcon({ className, size = 51 }: { className?: string; size?: number }) {
  const h = (43 / 51) * size;
  return (
    <svg
      className={className}
      width={size}
      height={h}
      viewBox="0 0 51 43"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M21.5141 1.74439C22.7141 1.02095 24.6739 0.299857 25.9841 0.0996563C27.3766 -0.113047 29.7593 0.0271399 31.1209 0.402222C33.8116 1.14332 36.2835 2.83807 37.8509 5.01652C38.7065 6.20553 39.5832 8.00968 39.8237 9.07601C39.9938 9.82992 40.0554 9.90978 40.5903 10.0689C41.3444 10.293 42.8718 11.2866 43.6507 12.0596C44.8589 13.2586 46.1074 15.6595 46.109 16.7868C46.1093 16.9409 46.4717 17.2316 47.0142 17.5127C48.1172 18.0842 49.5026 19.4333 50.0799 20.4979C52.3201 24.629 50.3081 29.6535 45.7937 31.2018C44.8756 31.5166 44.3885 31.5599 41.0692 31.6216C36.9712 31.6977 36.2044 31.5975 35.7625 30.928C35.3691 30.3324 35.4455 29.5085 35.9392 29.0181L36.3512 28.6089L40.5606 28.5308C44.5394 28.4568 44.8063 28.4334 45.4306 28.1022C45.7937 27.9097 46.3374 27.5002 46.6383 27.1926C48.8612 24.9212 47.9823 21.0405 45.0082 19.9954C43.3972 19.4294 43.2113 19.2028 43.0749 17.6391C42.8638 15.2178 40.9226 13.095 38.5256 12.6641C37.6492 12.5066 37.2267 11.9304 36.9238 10.4799C36.2402 7.2056 34.1093 4.7685 30.871 3.55729C29.9705 3.2205 29.5341 3.1583 27.9982 3.14736C26.4887 3.13673 25.995 3.19706 25.0331 3.50962C21.7699 4.57048 19.362 7.34484 18.7801 10.7143C18.5823 11.8605 18.4826 12.1043 18.0536 12.4914C17.5876 12.9122 17.5063 12.932 16.7536 12.8079C16.312 12.7352 15.2775 12.676 14.4546 12.6763C13.1037 12.677 12.8552 12.7252 11.8941 13.1728C9.89818 14.1024 8.44855 15.8866 7.95107 18.0255C7.66854 19.2401 7.39783 19.5463 6.33529 19.8528C4.77086 20.3041 3.63966 21.4403 3.17477 23.027C2.87209 24.0604 2.97902 25.007 3.52643 26.1402C3.94848 27.0139 4.50833 27.5615 5.53859 28.1085C6.14757 28.4318 6.44128 28.4573 10.3872 28.5308C14.5414 28.6081 14.592 28.613 14.9854 28.9802C15.5198 29.4789 15.6405 30.1053 15.3203 30.7197C14.8524 31.6175 14.3959 31.6955 10.0524 31.6197C5.6893 31.5435 5.00913 31.4128 3.37477 30.3362C-0.67679 27.6673 -1.1653 22.0245 2.37113 18.7416C2.91508 18.2366 3.73005 17.6491 4.18234 17.4361C4.95779 17.0707 5.02314 16.9935 5.32976 16.0788C6.5816 12.3459 10.3758 9.62206 14.4052 9.5633L15.8518 9.5422L16.0265 8.85908C16.6999 6.22429 18.9744 3.27551 21.5141 1.74439Z"
        fill="#F58807"
      />
      <path
        d="M21.187 20.6753C22.8111 19.0437 24.3524 17.5771 24.6123 17.416C25.1786 17.065 25.6611 17.0442 26.2344 17.346C26.7441 17.6143 32.2995 23.1491 32.5483 23.6366C32.8345 24.197 32.7523 24.8846 32.3426 25.3572C32.0292 25.7187 31.836 25.7958 31.2429 25.7958C30.5374 25.7958 30.4891 25.762 28.7917 24.0827L27.0602 22.3697L27.0174 27.6949L26.9745 37.5702L26.5414 38C25.937 38.5997 25.0198 38.5997 24.4154 38L23.9823 37.5702L23.9395 27.7009L23.8967 22.3816L22.1132 24.1278C20.4836 25.7234 20.2793 25.8739 19.7424 25.8739C18.887 25.8739 18.2342 25.1931 18.2342 24.3009C18.2342 23.655 18.2939 23.5817 21.187 20.6753Z"
        fill="#F58807"
      />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldPill}>{label}</span>
      <div className={styles.fieldBody}>{children}</div>
    </label>
  );
}

function EditChapterLoader({ bookSlug }: { bookSlug: string }) {
  return (
    <Container>
      <section className={styles.page} aria-label="Редагувати розділ">
        <header className={styles.top}>
          <Breadcrumb
            items={[
              { label: "Головна", to: "/" },
              { label: "Книга", to: `/books/${bookSlug}` },
              { label: "Редагувати розділ" },
            ]}
          />
          <PageTitle>Редагувати розділ</PageTitle>
        </header>
        <div style={{ textAlign: "center", padding: "48px 16px", color: "rgba(255,255,255,0.8)" }}>
          Завантаження…
        </div>
      </section>
    </Container>
  );
}

export default function EditChapter() {
  const { bookSlug = "", chapterId = "" } = useParams<{ bookSlug: string; chapterId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, authReady } = useAuth();
  const { showError } = useNotification();

  const chapterIdNum = parseInt(chapterId, 10);
  const [originalData, setOriginalData] = useState<ChapterForEdit | null>(null);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isFileChanged, setIsFileChanged] = useState(false);
  const [error, setError] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [selectedVolume, setSelectedVolume] = useState("");
  const [price, setPrice] = useState("1.00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editorMode, setEditorMode] = useState<"file" | "editor">("editor");
  const [contentJson, setContentJson] = useState<Record<string, unknown> | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef<Record<string, unknown> | null>(null);
  const contentVersionRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!authReady || !bookSlug) return;
    if (!isAuthenticated) {
      showError("Необхідна авторизація");
      navigate(`/books/${bookSlug}`, { replace: true });
    }
  }, [authReady, isAuthenticated, bookSlug, navigate, showError]);

  useEffect(() => {
    if (!authReady || !isAuthenticated || !chapterId || Number.isNaN(chapterIdNum)) return;

    let cancelled = false;

    async function loadData() {
      try {
        const data = await editorsApi.getChapterForEdit(chapterIdNum);
        if (cancelled) return;
        setOriginalData(data);
        setTitle(data.title);
        setSelectedVolume(data.volume != null ? String(data.volume) : "");
        setIsPaid(data.is_paid);
        setPrice(data.is_paid ? String(data.price) : "1.00");
      } catch (err) {
        if (cancelled) return;
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Помилка при завантаженні даних розділу";
        showError(message);
        navigate(`/books/${bookSlug}`, { replace: true });
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [authReady, isAuthenticated, chapterId, chapterIdNum, bookSlug, navigate, showError]);

  useEffect(() => {
    if (!authReady || !isAuthenticated || !originalData?.book_slug) return;
    let cancelled = false;

    (async () => {
      try {
        const vols = await catalogApi.getVolumes(originalData.book_slug);
        if (!cancelled) setVolumes(vols);
      } catch (err) {
        if (cancelled) return;
        console.error("EditChapter: failed to load volumes", err);
      }
    })();

    return () => { cancelled = true; };
  }, [authReady, isAuthenticated, originalData?.book_slug]);

  useEffect(() => {
    if (editorMode !== "editor" || !chapterIdNum) return;
    if (contentJson !== null) return;

    let cancelled = false;
    setIsLoadingContent(true);
    editorsApi
      .getChapterContent(chapterIdNum)
      .then((data) => {
        if (!cancelled) {
          setContentJson(data.content_json);
          contentVersionRef.current = data.content_version;
        }
      })
      .catch(() => {
        if (!cancelled) {
          showError("Не вдалося завантажити контент для редактора");
          setEditorMode("file");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingContent(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editorMode, contentJson, chapterIdNum, showError]);

  const saveContent = useCallback(
    async (json?: Record<string, unknown>): Promise<boolean> => {
      const contentToSave = json ?? latestContentRef.current;
      if (!contentToSave || !chapterIdNum) return false;

      setIsSavingContent(true);
      try {
        const result = await editorsApi.saveChapterContent(chapterIdNum, contentToSave, {
          expectedVersion: contentVersionRef.current,
        });
        contentVersionRef.current = result.content_version;
        setHasUnsavedChanges(false);
        return true;
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "content_version_conflict") {
          const ex = err as Error & { detail?: string };
          showError(
            typeof ex.detail === "string" && ex.detail
              ? ex.detail
              : "Версію контенту змінено в іншій вкладці."
          );
          try {
            const fresh = await editorsApi.getChapterContent(chapterIdNum);
            setContentJson(fresh.content_json);
            contentVersionRef.current = fresh.content_version;
          } catch {
            showError("Не вдалося оновити контент після конфлікту");
          }
        } else {
          showError("Помилка збереження контенту");
        }
        return false;
      } finally {
        setIsSavingContent(false);
      }
    },
    [chapterIdNum, showError]
  );

  const handleContentChange = useCallback(
    (json: Record<string, unknown>) => {
      latestContentRef.current = json;
      setHasUnsavedChanges(true);

      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
      autoSaveRef.current = setTimeout(() => {
        void saveContent(json);
      }, 3000);
    },
    [saveContent]
  );

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges || !chapterIdNum || !latestContentRef.current) return;
      const payload = JSON.stringify({
        content: latestContentRef.current,
        expected_version: contentVersionRef.current,
      });
      const payloadBytes = new Blob([payload]).size;
      if (payloadBytes > 60_000) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      const token = getAccess();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (authStore.csrfToken) headers["X-CSRFToken"] = authStore.csrfToken;
      const url = `/api/editors/chapters/${chapterIdNum}/content/save/`;
      void fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: payload,
        keepalive: true,
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [hasUnsavedChanges, chapterIdNum]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (!isDocxFile(selectedFile)) {
      setError("Будь ласка, завантажте файл у форматі .docx");
      setFile(null);
      e.target.value = "";
      return;
    }
    setError("");
    setFile(selectedFile);
    setIsFileChanged(true);
  }, []);

  const handleStatusChange = useCallback((checked: boolean) => {
    setIsPaid(checked);
    if (!checked) setPrice("1.00");
  }, []);

  const handlePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === "") {
      setPrice("");
      return;
    }
    const num = parseFloat(v);
    if (!Number.isNaN(num) && num > 0 && num <= 1000) setPrice(v);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      if (!title?.trim()) {
        setError("Заповніть назву розділу");
        return;
      }

      if (isPaid) {
        const priceNum = parseFloat(price);
        if (!price || Number.isNaN(priceNum) || priceNum <= 0) {
          setError("Вкажіть коректну вартість глави");
          return;
        }
        if (priceNum > 1000) {
          setError("Максимальна вартість глави - 1000 грн");
          return;
        }
      }

      if (!originalData) return;

      setIsSubmitting(true);
      try {
        const formData = new FormData();
        formData.append("title", title.trim());
        formData.append("is_paid", String(isPaid));
        formData.append("price", isPaid ? price : "1.00");

        const origVol = originalData.volume;
        const origVolStr = origVol != null ? String(origVol) : "";
        if (selectedVolume !== origVolStr) {
          formData.append("volume", selectedVolume || "");
        }

        if (editorMode === "file" && isFileChanged && file) {
          formData.append("file", file);
          if (contentVersionRef.current != null) {
            formData.append("expected_version", String(contentVersionRef.current));
          }
        }

        await editorsApi.updateChapter(chapterIdNum, formData);
        await queryClient.invalidateQueries({ queryKey: catalogKeys.chapters(originalData.book_slug) });
        await queryClient.invalidateQueries({ queryKey: catalogKeys.book(originalData.book_slug) });
        navigate(`/books/${originalData.book_slug}`, { state: { chapterUpdated: true } });
      } catch (err) {
        const axErr = err as { response?: { data?: { error?: string } }; message?: string };
        const message =
          axErr?.response?.data?.error ??
          (axErr?.message ? String(axErr.message) : "Помилка при оновленні розділу");
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      title,
      isPaid,
      price,
      selectedVolume,
      file,
      isFileChanged,
      editorMode,
      originalData,
      chapterIdNum,
      navigate,
      queryClient,
    ]
  );

  if (!authReady) return <EditChapterLoader bookSlug={bookSlug} />;
  if (!isAuthenticated) return null;
  if (!originalData) return <EditChapterLoader bookSlug={bookSlug} />;

  return (
    <Container>
      <form
        className={styles.page}
        onSubmit={handleSubmit}
        aria-label="Форма редагування розділу"
      >
        <header className={styles.top}>
          <Breadcrumb
            items={[
              { label: "Головна", to: "/" },
              { label: originalData.book_title ?? "Книга", to: `/books/${originalData.book_slug}` },
              { label: "Редагувати розділ" },
            ]}
          />
          <PageTitle>Редагувати розділ</PageTitle>
        </header>

        <div className={styles.gridTwo}>
          <Field label="Назва розділу">
            <input
              type="text"
              className={styles.input}
              placeholder="Назва розділу"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              aria-required
            />
          </Field>
        </div>

        <div className={styles.field} style={{ marginTop: 8 }}>
          <span className={styles.fieldPill}>Контент розділу</span>
          <div className={styles.fieldBody}>
            <p className={styles.modeHint}>
              Це форма <strong>«Редагувати розділ»</strong> (інша сторінка, ніж додавання нового). Типово відкрито
              редактор; новий .docx — режим «Файл .docx».
            </p>
            <div className={styles.modeSwitch} role="group" aria-label="Редактор або файл .docx">
              <button
                type="button"
                className={`${styles.modeBtn} ${editorMode === "editor" ? styles.modeBtnActive : ""}`}
                onClick={() => setEditorMode("editor")}
                aria-pressed={editorMode === "editor"}
              >
                Редактор на сайті
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${editorMode === "file" ? styles.modeBtnActive : ""}`}
                onClick={() => {
                  void (async () => {
                    if (hasUnsavedChanges) {
                      if (
                        !window.confirm(
                          "Є незбережені зміни в редакторі. Зберегти перед перемиканням на завантаження файлу?"
                        )
                      ) {
                        return;
                      }
                      if (autoSaveRef.current) {
                        clearTimeout(autoSaveRef.current);
                        autoSaveRef.current = null;
                      }
                      const ok = await saveContent();
                      if (!ok) return;
                    }
                    setContentJson(null);
                    latestContentRef.current = null;
                    setHasUnsavedChanges(false);
                    setEditorMode("file");
                  })();
                }}
                aria-pressed={editorMode === "file"}
              >
                Файл .docx
              </button>
            </div>

            {editorMode === "file" ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  className={styles.hiddenInput}
                  aria-label="Вибрати новий файл .docx"
                />
                <button
                  type="button"
                  className={styles.mainImageDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ maxWidth: 320, marginTop: 12 }}
                >
                  {file ? (
                    <span className={styles.uploadText}>{file.name}</span>
                  ) : (
                    <>
                      <div className={styles.uploadCircle}>
                        <UploadCloudIcon className={styles.uploadIconMain} size={51} />
                      </div>
                      <span className={styles.uploadText}>
                        {isFileChanged ? "Новий файл обрано" : "Вибрати новий файл .docx"}
                      </span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                {isLoadingContent ? (
                  <div className={styles.editorPlaceholder}>Завантаження контенту…</div>
                ) : (
                  <LazyChapterEditor
                    initialContent={contentJson}
                    onContentChange={handleContentChange}
                    isSaving={isSavingContent}
                    onImageUpload={(file) => editorsApi.uploadEditorImage(chapterIdNum, file)}
                  />
                )}
                {hasUnsavedChanges && (
                  <div className={styles.unsavedHint}>
                    Є незбережені зміни (автозбереження через 3 сек)
                  </div>
                )}
                <button
                  type="button"
                  className={styles.saveContentBtn}
                  onClick={() => void saveContent()}
                  disabled={!hasUnsavedChanges || isSavingContent}
                >
                  {isSavingContent ? "Збереження…" : "Зберегти контент зараз"}
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <FilterCheckbox
            id="edit-chapter-paid"
            label="Закритий доступ (потребує оплати)"
            checked={isPaid}
            onChange={handleStatusChange}
          />
        </div>

        {isPaid && (
          <div style={{ marginTop: 12, maxWidth: 200 }}>
            <Field label="Вартість (₴)">
              <input
                type="number"
                className={styles.input}
                min={0.01}
                max={1000}
                step={0.01}
                value={price}
                onChange={handlePriceChange}
                required={isPaid}
                aria-required={isPaid}
              />
            </Field>
          </div>
        )}

        {volumes.length > 0 && (
          <div style={{ marginTop: 16, maxWidth: 320 }}>
            <div className={styles.pillSelect}>
              <div className={styles.pillLabel}>Том</div>
              <select
                className={styles.pillSelectNative}
                value={selectedVolume}
                onChange={(e) => setSelectedVolume(e.target.value)}
                aria-label="Оберіть том"
              >
                <option value="">Без тому</option>
                {volumes.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" style={{ color: "#e57373", marginTop: 16 }}>
            {error}
          </p>
        )}

        <div className={styles.submitRow} style={{ paddingTop: 24 }}>
          <ActionButton
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            loading={isSubmitting}
            ariaLabel="Зберегти зміни"
          >
            {isSubmitting ? "Збереження…" : "Зберегти зміни"}
          </ActionButton>
        </div>
      </form>
    </Container>
  );
}
