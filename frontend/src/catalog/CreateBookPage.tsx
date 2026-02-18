import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import styles from "./styles/CreateBookPage.module.css";
import { Container } from "../shared/Container";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { Icon } from "../shared/Icon";
import icon18CreateBook from "../assets/backgrounds/18+CreateBook.svg";
import { RequireAuth } from "../auth/RequireAuth";
import { useAuth } from "../auth/useAuth";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import {
  getGenres,
  getTags,
  getCountries,
  getFandoms,
  createBook,
  STALE_REF,
  type CreateBookPayload,
  type TagWithGroup,
} from "../api/catalogApi";

/** Пунктирна лінія для груп тегів (адаптивна довжина) */
function DashedLine({ className }: { className?: string }) {
  return (
    <span className={className} role="presentation">
      <svg width="100%" height="2" viewBox="0 0 1013 2" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M1 1H1012" stroke="#F58807" strokeWidth="2" strokeLinecap="round" strokeDasharray="0.1 10" />
      </svg>
    </span>
  );
}

/** Іконка завантаження (хмара + стрілка) */
function UploadCloudIcon({ className, size = 51 }: { className?: string; size?: number }) {
  const h = (43 / 51) * size;
  return (
    <svg className={className} width={size} height={h} viewBox="0 0 51 43" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M21.5141 1.74439C22.7141 1.02095 24.6739 0.299857 25.9841 0.0996563C27.3766 -0.113047 29.7593 0.0271399 31.1209 0.402222C33.8116 1.14332 36.2835 2.83807 37.8509 5.01652C38.7065 6.20553 39.5832 8.00968 39.8237 9.07601C39.9938 9.82992 40.0554 9.90978 40.5903 10.0689C41.3444 10.293 42.8718 11.2866 43.6507 12.0596C44.8589 13.2586 46.1074 15.6595 46.109 16.7868C46.1093 16.9409 46.4717 17.2316 47.0142 17.5127C48.1172 18.0842 49.5026 19.4333 50.0799 20.4979C52.3201 24.629 50.3081 29.6535 45.7937 31.2018C44.8756 31.5166 44.3885 31.5599 41.0692 31.6216C36.9712 31.6977 36.2044 31.5975 35.7625 30.928C35.3691 30.3324 35.4455 29.5085 35.9392 29.0181L36.3512 28.6089L40.5606 28.5308C44.5394 28.4568 44.8063 28.4334 45.4306 28.1022C45.7937 27.9097 46.3374 27.5002 46.6383 27.1926C48.8612 24.9212 47.9823 21.0405 45.0082 19.9954C43.3972 19.4294 43.2113 19.2028 43.0749 17.6391C42.8638 15.2178 40.9226 13.095 38.5256 12.6641C37.6492 12.5066 37.2267 11.9304 36.9238 10.4799C36.2402 7.2056 34.1093 4.7685 30.871 3.55729C29.9705 3.2205 29.5341 3.1583 27.9982 3.14736C26.4887 3.13673 25.995 3.19706 25.0331 3.50962C21.7699 4.57048 19.362 7.34484 18.7801 10.7143C18.5823 11.8605 18.4826 12.1043 18.0536 12.4914C17.5876 12.9122 17.5063 12.932 16.7536 12.8079C16.312 12.7352 15.2775 12.676 14.4546 12.6763C13.1037 12.677 12.8552 12.7252 11.8941 13.1728C9.89818 14.1024 8.44855 15.8866 7.95107 18.0255C7.66854 19.2401 7.39783 19.5463 6.33529 19.8528C4.77086 20.3041 3.63966 21.4403 3.17477 23.027C2.87209 24.0604 2.97902 25.007 3.52643 26.1402C3.94848 27.0139 4.50833 27.5615 5.53859 28.1085C6.14757 28.4318 6.44128 28.4573 10.3872 28.5308C14.5414 28.6081 14.592 28.613 14.9854 28.9802C15.5198 29.4789 15.6405 30.1053 15.3203 30.7197C14.8524 31.6175 14.3959 31.6955 10.0524 31.6197C5.6893 31.5435 5.00913 31.4128 3.37477 30.3362C-0.67679 27.6673 -1.1653 22.0245 2.37113 18.7416C2.91508 18.2366 3.73005 17.6491 4.18234 17.4361C4.95779 17.0707 5.02314 16.9935 5.32976 16.0788C6.5816 12.3459 10.3758 9.62206 14.4052 9.5633L15.8518 9.5422L16.0265 8.85908C16.6999 6.22429 18.9744 3.27551 21.5141 1.74439Z" fill="#F58807"/>
      <path d="M21.187 20.6753C22.8111 19.0437 24.3524 17.5771 24.6123 17.416C25.1786 17.065 25.6611 17.0442 26.2344 17.346C26.7441 17.6143 32.2995 23.1491 32.5483 23.6366C32.8345 24.197 32.7523 24.8846 32.3426 25.3572C32.0292 25.7187 31.836 25.7958 31.2429 25.7958C30.5374 25.7958 30.4891 25.762 28.7917 24.0827L27.0602 22.3697L27.0174 27.6949L26.9745 37.5702L26.5414 38C25.937 38.5997 25.0198 38.5997 24.4154 38L23.9823 37.5702L23.9395 27.7009L23.8967 22.3816L22.1132 24.1278C20.4836 25.7234 20.2793 25.8739 19.7424 25.8739C18.887 25.8739 18.2342 25.1931 18.2342 24.3009C18.2342 23.655 18.2939 23.5817 21.187 20.6753Z" fill="#F58807"/>
    </svg>
  );
}

const BOOK_TYPES = [
  { value: "TRANSLATION" as const, label: "Переклад" },
  { value: "AUTHOR" as const, label: "Авторський" },
];

const TRANSLATION_STATUSES = [
  { value: "TRANSLATING", label: "Перекладається" },
  { value: "WAITING", label: "В очікуванні розділів" },
  { value: "PAUSED", label: "Перерва" },
  { value: "ABANDONED", label: "Покинутий" },
];

const ORIGINAL_STATUSES = [
  { value: "ONGOING", label: "Виходить" },
  { value: "STOPPED", label: "Припинено" },
  { value: "COMPLETED", label: "Завершено" },
];

const INVALID_NEW_BOOK_TRANSLATION_STATUSES = [
  "PAUSED",
  "ABANDONED",
  "COMPLETED",
  "STOPPED",
  "Перерва",
  "Закінчено",
  "Зупинено",
];

const DESCRIPTION_MAX_WORDS = 250;
const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB

type FormData = {
  title: string;
  title_en: string;
  author: string;
  description: string;
  book_type: "AUTHOR" | "TRANSLATION";
  translation_status: string;
  original_status: string;
  country: string;
  genres: number[];
  tags: number[];
  fandoms: number[];
  adult_content: boolean;
  image: File | null;
};

const initialFormData: FormData = {
  title: "",
  title_en: "",
  author: "",
  description: "",
  book_type: "TRANSLATION",
  translation_status: "TRANSLATING",
  original_status: "",
  country: "",
  genres: [],
  tags: [],
  fandoms: [],
  adult_content: false,
  image: null,
};

function CreateBookPageInner() {
  const navigate = useNavigate();
  const { authReady, isAuthenticated } = useAuth();
  const { showError, showSuccess } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [tagsShowAll, setTagsShowAll] = useState(false);

  const { data: genres = [], isLoading: genresLoading } = useQuery({
    queryKey: ["genres"],
    queryFn: getGenres,
    staleTime: STALE_REF,
    refetchOnWindowFocus: false,
  });

  const { data: tags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: getTags,
    staleTime: STALE_REF,
    refetchOnWindowFocus: false,
  });

  const { data: countries = [], isLoading: countriesLoading } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
    staleTime: STALE_REF,
    refetchOnWindowFocus: false,
  });

  const { data: fandoms = [], isLoading: fandomsLoading } = useQuery({
    queryKey: ["fandoms"],
    queryFn: getFandoms,
    staleTime: STALE_REF,
    refetchOnWindowFocus: false,
  });

  const adultTagId = tags.find((t) => t.name === "18+")?.id ?? null;

  const tagGroups = useMemo(() => {
    const byGroup = new Map<string, TagWithGroup[]>();
    for (const t of tags) {
      const key = t.group?.name ?? "Інше";
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(t);
    }
    return Array.from(byGroup.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, tagList]) => ({ name, tags: tagList }));
  }, [tags]);

  const tagGroupsToShow = tagsShowAll ? tagGroups : tagGroups.slice(0, 2);

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

  const handleGenreClick = useCallback((genreId: number) => {
    setFormData((prev) => {
      const next = prev.genres.includes(genreId)
        ? prev.genres.filter((id) => id !== genreId)
        : [...prev.genres, genreId].slice(0, 5);
      return { ...prev, genres: next };
    });
  }, []);

  const handleTagClick = useCallback(
    (tagId: number) => {
      setFormData((prev) => {
        const newTags = prev.tags.includes(tagId)
          ? prev.tags.filter((id) => id !== tagId)
          : [...prev.tags, tagId].slice(0, 10);
        const hasAdult = adultTagId != null && newTags.includes(adultTagId);
        return { ...prev, tags: newTags, adult_content: hasAdult };
      });
    },
    [adultTagId]
  );

  const handleFandomClick = useCallback((fandomId: number) => {
    setFormData((prev) => ({
      ...prev,
      fandoms: prev.fandoms.includes(fandomId)
        ? prev.fandoms.filter((id) => id !== fandomId)
        : [...prev.fandoms, fandomId],
    }));
  }, []);

  const handleAdultCheckboxChange = useCallback(
    (checked: boolean) => {
      if (adultTagId == null) {
        setFormData((prev) => ({ ...prev, adult_content: checked }));
        return;
      }
      setFormData((prev) => {
        let newTags = [...prev.tags];
        if (checked && !newTags.includes(adultTagId)) newTags = [...newTags, adultTagId];
        else if (!checked) newTags = newTags.filter((id) => id !== adultTagId);
        return { ...prev, adult_content: checked, tags: newTags };
      });
    },
    [adultTagId]
  );

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showError("Будь ласка, завантажте зображення (image)");
        return;
      }
      if (file.size > IMAGE_MAX_SIZE) {
        showError("Розмір файлу не повинен перевищувати 5 МБ");
        return;
      }
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(URL.createObjectURL(file));
      setFormData((prev) => ({ ...prev, image: file }));
    },
    [imagePreview, showError]
  );

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const validateForm = useCallback((): boolean => {
    const err: string[] = [];
    if (!formData.title?.trim()) err.push("Назва книги обов'язкова");
    if (!formData.author?.trim()) err.push("Ім'я автора обов'язкове");
    if (formData.description && formData.description.trim().split(/\s+/).length > DESCRIPTION_MAX_WORDS) {
      err.push(`Опис не може перевищувати ${DESCRIPTION_MAX_WORDS} слів`);
    }
    if (formData.genres.length === 0) err.push("Виберіть хоча б один жанр");
    if (!formData.country) err.push("Виберіть країну");
    if (!formData.original_status) err.push("Оберіть статус випуску оригіналу");
    if (formData.book_type === "TRANSLATION") {
      if (!formData.translation_status) err.push("Оберіть статус перекладу");
      else if (INVALID_NEW_BOOK_TRANSLATION_STATUSES.includes(formData.translation_status)) {
        err.push("Для нових книг використовуйте статус «Перекладається» або «В очікуванні розділів»");
      }
    }
    if (err.length > 0) {
      showError(err.join(". "));
      return false;
    }
    return true;
  }, [formData, showError]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return;
      if (!validateForm()) return;

      const countryId = Number(formData.country);
      if (Number.isNaN(countryId)) {
        showError("Невірна країна");
        return;
      }

      const payload: CreateBookPayload = {
        title: formData.title.trim(),
        title_en: formData.title_en.trim() || undefined,
        author: formData.author.trim(),
        description: formData.description.trim() || undefined,
        book_type: formData.book_type,
        translation_status:
          formData.book_type === "AUTHOR" ? null : formData.translation_status || "TRANSLATING",
        original_status: formData.original_status,
        country: countryId,
        genres: formData.genres,
        tags: formData.tags,
        fandoms: formData.fandoms,
        adult_content: formData.adult_content,
        image: formData.image ?? undefined,
      };
      createBookMutation.mutate(payload);
    },
    [formData, isSubmitting, validateForm, showError, createBookMutation]
  );

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      translation_status: prev.book_type === "AUTHOR" ? "" : "TRANSLATING",
    }));
  }, [formData.book_type]);

  if (!authReady || genresLoading || tagsLoading || countriesLoading || fandomsLoading) {
    return (
      <Container>
        <section className={styles.page} aria-label="Створення книги">
          <header className={styles.top}>
            <nav className={styles.breadcrumbs} aria-label="Breadcrumbs">
              <Link className={styles.crumb} to="/">Головна</Link>
              <span className={styles.crumbSep}>›</span>
              <span className={styles.crumb} aria-current="page">Створення</span>
            </nav>
            <h1 className={styles.h1}>Створення</h1>
          </header>
          <div style={{ textAlign: "center", padding: "48px 16px", color: "rgba(255,255,255,0.8)" }}>
            Завантаження даних…
          </div>
        </section>
      </Container>
    );
  }

  if (!isAuthenticated) {
    return null;
  }


  return (
    <Container>
      <form className={styles.page} onSubmit={handleSubmit} aria-label="Створення книги">
        <header className={styles.top}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumbs">
            <Link className={styles.crumb} to="/">Головна</Link>
            <span className={styles.crumbSep}>›</span>
            <span className={styles.crumb} aria-current="page">Створення</span>
          </nav>
          <h1 className={styles.h1}>Створення</h1>
        </header>

        <div className={styles.gridTwo}>
          <Field label="Назва мовою оригіналу">
            <input
              className={styles.input}
              placeholder="Назва мовою оригіналу"
              value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
            />
          </Field>
          <Field label="Назва мовою перекладу">
            <input
              className={styles.input}
              placeholder="Назва мовою перекладу"
              value={formData.title_en}
              onChange={(e) => setFormData((p) => ({ ...p, title_en: e.target.value }))}
            />
          </Field>
        </div>

        <div className={styles.selectRow}>
          <PillSelect
            label="Тип твору"
            value={formData.book_type}
            options={BOOK_TYPES}
            onChange={(v) => setFormData((p) => ({ ...p, book_type: v as "AUTHOR" | "TRANSLATION" }))}
          />
          <Field label="Автор твору">
            <input
              className={styles.input}
              placeholder="..."
              value={formData.author}
              onChange={(e) => setFormData((p) => ({ ...p, author: e.target.value }))}
            />
          </Field>
          <PillSelect
            label="Статус випуску"
            value={formData.original_status}
            options={ORIGINAL_STATUSES}
            onChange={(v) => setFormData((p) => ({ ...p, original_status: v }))}
          />
          {formData.book_type === "TRANSLATION" && (
            <PillSelect
              label="Статус перекладу"
              value={formData.translation_status}
              options={TRANSLATION_STATUSES.filter(
                (s) => !INVALID_NEW_BOOK_TRANSLATION_STATUSES.includes(s.value)
              )}
              onChange={(v) => setFormData((p) => ({ ...p, translation_status: v }))}
            />
          )}
          <PillSelect
            label="Країна твору"
            value={formData.country}
            options={countries.map((c) => ({ value: String(c.id), label: c.name }))}
            onChange={(v) => setFormData((p) => ({ ...p, country: v }))}
          />
        </div>

        <div className={styles.descGrid}>
          <Field label="Опис / рецензія">
            <textarea
              className={styles.textarea}
              placeholder="Напишіть будь ласка опис/рецензію до цього твору..."
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            />
            {formData.description && (
              <div className={styles.hint} style={{ marginTop: 4 }}>
                {formData.description.trim().split(/\s+/).filter(Boolean).length}/{DESCRIPTION_MAX_WORDS} слів
              </div>
            )}
          </Field>
          <aside className={styles.contentCard} aria-label="Контент">
            <div className={styles.contentTop}>
              <span className={styles.contentLabel}>Контент</span>
              <button
                type="button"
                className={styles.checkboxBtn}
                onClick={() => handleAdultCheckboxChange(!formData.adult_content)}
                aria-label="Контент 18+"
                aria-pressed={formData.adult_content}
              >
                <Icon
                  name={formData.adult_content ? "content_checkbox_checked" : "content_checkbox"}
                  aria-hidden
                />
              </button>
            </div>
            <div className={styles.contentBadge} aria-hidden="true">
              <img
                src={icon18CreateBook}
                alt=""
                className={styles.badge18Img}
                width={116}
                height={115}
              />
            </div>
          </aside>
        </div>

        <Panel title="Жанр">
          <div className={styles.chipsGrid}>
            {genres.map((g) => (
              <Chip
                key={g.id}
                text={g.name}
                selected={formData.genres.includes(g.id)}
                onClick={() => handleGenreClick(g.id)}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Теги">
          <div className={styles.tagsWrap}>
            {tagGroupsToShow.map((gr) => (
              <div key={gr.name} className={styles.tagGroup}>
                <div className={styles.tagGroupHead}>
                  <div className={styles.tagGroupTitle}>{gr.name}</div>
                  <DashedLine className={styles.tagGroupLine} />
                </div>
                <div className={styles.tagRowChips}>
                  {gr.tags.map((t) => (
                    <Chip
                      key={t.id}
                      text={t.name}
                      selected={formData.tags.includes(t.id)}
                      onClick={() => handleTagClick(t.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {tagGroups.length > 2 && !tagsShowAll && (
              <div className={styles.centerRow}>
                <button
                  type="button"
                  className={styles.showAllBtn}
                  onClick={() => setTagsShowAll(true)}
                >
                  Показати всі <span className={styles.chev}>▾</span>
                </button>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Фендом">
          <div className={styles.fandomGrid}>
            <div className={styles.fandomChipsWrap}>
              {fandoms.map((f) => (
                <Chip
                  key={f.id}
                  text={f.name}
                  tone={formData.fandoms.includes(f.id) ? "blue" : "default"}
                  selected={formData.fandoms.includes(f.id)}
                  onClick={() => handleFandomClick(f.id)}
                />
              ))}
            </div>
          </div>
        </Panel>

        <div className={styles.imagesGrid}>
          <section className={styles.imagePanel} aria-label="Основне зображення">
            <div className={styles.panelTitlePill}>Основне зображення</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className={styles.hiddenInput}
              aria-hidden
              onChange={handleImageChange}
            />
            <button
              type="button"
              className={styles.mainImageDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt=""
                  className={styles.previewImg}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                />
              ) : (
                <>
                  <div className={styles.uploadCircle}>
                    <UploadCloudIcon className={styles.uploadIconMain} size={51} />
                  </div>
                  <span className={styles.uploadText}>Вибрати зображення</span>
                </>
              )}
            </button>
          </section>
          <section className={styles.imagePanel} aria-label="Додаткові зображення">
            <div className={styles.panelTitlePill}>Додаткові зображення</div>
            <div className={styles.extraImagesRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={styles.extraSlot} aria-hidden>
                  <UploadCloudIcon className={styles.uploadIconSmall} size={51} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.submitRow}>
          <ActionButton
            type="submit"
            variant="bookFrame"
            disabled={isSubmitting}
            ariaLabel="Опублікувати переклад"
          >
            {isSubmitting ? "Створення…" : "Опублікувати переклад"}
          </ActionButton>
        </div>
      </form>
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldPill}>
        {label}
        {hint ? <span className={styles.hint}> {hint}</span> : null}
      </span>
      <div className={styles.fieldBody}>{children}</div>
    </label>
  );
}

function PillSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.pillSelect}>
      <div className={styles.pillLabel}>{label}</div>
      <select
        className={styles.pillSelectNative}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={label}
      >
        <option value="">Оберіть</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelTitle}>{title}</div>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

function Chip({
  text,
  tone = "default",
  selected,
  onClick,
}: {
  text: string;
  tone?: "default" | "blue";
  selected?: boolean;
  onClick?: () => void;
}) {
  const cls = [
    styles.chip,
    selected || tone === "blue" ? styles.chipBlue : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} onClick={onClick}>
      {text || "\u00A0"}
    </button>
  );
}
