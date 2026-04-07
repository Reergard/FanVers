import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ShowMoreNavigation } from "../../../navigation/ShowMoreNavigation";
import { ActionButton } from "../../../shared/ActionButton/ActionButton";
import { Icon } from "../../../shared/Icon";
import icon18CreateBook from "../../../assets/backgrounds/18+CreateBook.svg";
import type { BookCountry, BookMetaItem, CreateBookPayload, TagWithGroup, UpdateBookPayload } from "../../../api/catalogApi";
import {
  DESCRIPTION_MAX_CHARS,
  INVALID_NEW_BOOK_TRANSLATION_STATUSES,
  normalizeBookPayload,
  validateBookForm,
} from "./bookForm.utils";
import styles from "./BookForm.module.css";

export const BOOK_TYPES = [
  { value: "TRANSLATION" as const, label: "Переклад" },
  { value: "AUTHOR" as const, label: "Авторський" },
];

export const TRANSLATION_STATUSES = [
  { value: "TRANSLATING", label: "Перекладається" },
  { value: "WAITING", label: "В очікуванні розділів" },
  { value: "PAUSED", label: "Перерва" },
  { value: "ABANDONED", label: "Покинутий" },
];

export const ORIGINAL_STATUSES = [
  { value: "ONGOING", label: "Виходить" },
  { value: "STOPPED", label: "Припинено" },
  { value: "COMPLETED", label: "Завершено" },
];

/** Обкладинка книги: макс. розмір при створенні / редагуванні */
export const BOOK_COVER_MAX_MB = 10;
export const IMAGE_MAX_SIZE = BOOK_COVER_MAX_MB * 1024 * 1024;
export const TAG_GROUPS_PAGE_SIZE = 1;

export type BookFormMode = "create" | "update";

export type BookFormData = {
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

export const initialFormData: BookFormData = {
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

type BookFormMeta = {
  genres: BookMetaItem[];
  tags: TagWithGroup[];
  countries: BookCountry[];
  fandoms: BookMetaItem[];
  adultTagId: number | null;
  tagGroups: { name: string; tags: TagWithGroup[] }[];
};

type BookFormProps = {
  mode: BookFormMode;
  initialValues: BookFormData;
  initialImagePreview?: string | null;
  meta: BookFormMeta;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (payload: CreateBookPayload | UpdateBookPayload) => void;
  onError: (msg: string) => void;
};

function DashedLine({ className }: { className?: string }) {
  return (
    <span className={className} role="presentation">
      <svg width="100%" height="2" viewBox="0 0 1013 2" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M1 1H1012" stroke="#F58807" strokeWidth="2" strokeLinecap="round" strokeDasharray="0.1 10" />
      </svg>
    </span>
  );
}

function UploadCloudIcon({ className, size = 51 }: { className?: string; size?: number }) {
  const h = (43 / 51) * size;
  return (
    <svg className={className} width={size} height={h} viewBox="0 0 51 43" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M21.5141 1.74439C22.7141 1.02095 24.6739 0.299857 25.9841 0.0996563C27.3766 -0.113047 29.7593 0.0271399 31.1209 0.402222C33.8116 1.14332 36.2835 2.83807 37.8509 5.01652C38.7065 6.20553 39.5832 8.00968 39.8237 9.07601C39.9938 9.82992 40.0554 9.90978 40.5903 10.0689C41.3444 10.293 42.8718 11.2866 43.6507 12.0596C44.8589 13.2586 46.1074 15.6595 46.109 16.7868C46.1093 16.9409 46.4717 17.2316 47.0142 17.5127C48.1172 18.0842 49.5026 19.4333 50.0799 20.4979C52.3201 24.629 50.3081 29.6535 45.7937 31.2018C44.8756 31.5166 44.3885 31.5599 41.0692 31.6216C36.9712 31.6977 36.2044 31.5975 35.7625 30.928C35.3691 30.3324 35.4455 29.5085 35.9392 29.0181L36.3512 28.6089L40.5606 28.5308C44.5394 28.4568 44.8063 28.4334 45.4306 28.1022C45.7937 27.9097 46.3374 27.5002 46.6383 27.1926C48.8612 24.9212 47.9823 21.0405 45.0082 19.9954C43.3972 19.4294 43.2113 19.2028 43.0749 17.6391C42.8638 15.2178 40.9226 13.095 38.5256 12.6641C37.6492 12.5066 37.2267 11.9304 36.9238 10.4799C36.2402 7.2056 34.1093 4.7685 30.871 3.55729C29.9705 3.2205 29.5341 3.1583 27.9982 3.14736C26.4887 3.13673 25.995 3.19706 25.0331 3.50962C21.7699 4.57048 19.362 7.34484 18.7801 10.7143C18.5823 11.8605 18.4826 12.1043 18.0536 12.4914C17.5876 12.9122 17.5063 12.932 16.7536 12.8079C16.312 12.7352 15.2775 12.676 14.4546 12.6763C13.1037 12.677 12.8552 12.7252 11.8941 13.1728C9.89818 14.1024 8.44855 15.8866 7.95107 18.0255C7.66854 19.2401 7.39783 19.5463 6.33529 19.8528C4.77086 20.3041 3.63966 21.4403 3.17477 23.027C2.87209 24.0604 2.97902 25.007 3.52643 26.1402C3.94848 27.0139 4.50833 27.5615 5.53859 28.1085C6.14757 28.4318 6.44128 28.4573 10.3872 28.5308C14.5414 28.6081 14.592 28.613 14.9854 28.9802C15.5198 29.4789 15.6405 30.1053 15.3203 30.7197C14.8524 31.6175 14.3959 31.6955 10.0524 31.6197C5.6893 31.5435 5.00913 31.4128 3.37477 30.3362C-0.67679 27.6673 -1.1653 22.0245 2.37113 18.7416C2.91508 18.2366 3.73005 17.6491 4.18234 17.4361C4.95779 17.0707 5.02314 16.9935 5.32976 16.0788C6.5816 12.3459 10.3758 9.62206 14.4052 9.5633L15.8518 9.5422L16.0265 8.85908C16.6999 6.22429 18.9744 3.27551 21.5141 1.74439Z" fill="#F58807"/>
      <path d="M21.187 20.6753C22.8111 19.0437 24.3524 17.5771 24.6123 17.416C25.1786 17.065 25.6611 17.0442 26.2344 17.346C26.7441 17.6143 32.2995 23.1491 32.5483 23.6366C32.8345 24.197 32.7523 24.8846 32.3426 25.3572C32.0292 25.7187 31.836 25.7958 31.2429 25.7958C30.5374 25.7958 30.4891 25.762 28.7917 24.0827L27.0602 22.3697L27.0174 27.6949L26.9745 37.5702L26.5414 38C25.937 38.5997 25.0198 38.5997 24.4154 38L23.9823 37.5702L23.9395 27.7009L23.8967 22.3816L22.1132 24.1278C20.4836 25.7234 20.2793 25.8739 19.7424 25.8739C18.887 25.8739 18.2342 25.1931 18.2342 24.3009C18.2342 23.655 18.2939 23.5817 21.187 20.6753Z" fill="#F58807"/>
    </svg>
  );
}

export function BookForm({
  mode,
  initialValues,
  initialImagePreview = null,
  meta,
  submitLabel,
  submitting,
  onSubmit,
  onError,
}: BookFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [formData, setFormData] = useState<BookFormData>(initialValues);
  const [imagePreview, setImagePreview] = useState<string | null>(initialImagePreview);
  const [tagGroupsVisibleCount, setTagGroupsVisibleCount] = useState(() =>
    mode === "update" ? (meta.tagGroups?.length ?? TAG_GROUPS_PAGE_SIZE) : TAG_GROUPS_PAGE_SIZE
  );

  useEffect(() => {
    setFormData(initialValues);
    setImagePreview(initialImagePreview ?? null);
  }, [initialValues, initialImagePreview]);

  const handleBookTypeChange = useCallback((v: string) => {
    const next = v as "AUTHOR" | "TRANSLATION";
    setFormData((prev) => ({
      ...prev,
      book_type: next,
      translation_status: next === "AUTHOR" ? "" : prev.translation_status || "TRANSLATING",
    }));
  }, []);

  useEffect(() => {
    setTagGroupsVisibleCount(
      mode === "update" ? meta.tagGroups.length : TAG_GROUPS_PAGE_SIZE
    );
  }, [meta.tagGroups, mode]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const translationStatusOptions = useMemo(() => {
    if (mode === "update") return TRANSLATION_STATUSES;
    return TRANSLATION_STATUSES.filter((s) => !INVALID_NEW_BOOK_TRANSLATION_STATUSES.includes(s.value));
  }, [mode]);

  const tagGroupsToShow = meta.tagGroups.slice(0, tagGroupsVisibleCount);

  const showMoreTagGroups = useCallback(() => {
    setTagGroupsVisibleCount(meta.tagGroups.length);
  }, [meta.tagGroups.length]);

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
        const hasAdult = meta.adultTagId != null && newTags.includes(meta.adultTagId);
        return { ...prev, tags: newTags, adult_content: hasAdult };
      });
    },
    [meta.adultTagId]
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
      const tagId = meta.adultTagId;
      if (tagId == null) {
        setFormData((prev) => ({ ...prev, adult_content: checked }));
        return;
      }
      setFormData((prev) => {
        let newTags = [...prev.tags];
        if (checked && !newTags.includes(tagId)) newTags = [...newTags, tagId];
        else if (!checked) newTags = newTags.filter((id) => id !== tagId);
        return { ...prev, adult_content: checked, tags: newTags };
      });
    },
    [meta.adultTagId]
  );

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        onError("Будь ласка, завантажте зображення (image)");
        return;
      }
      if (file.size > IMAGE_MAX_SIZE) {
        onError(`Розмір файлу не повинен перевищувати ${BOOK_COVER_MAX_MB} МБ`);
        return;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const nextPreview = URL.createObjectURL(file);
      objectUrlRef.current = nextPreview;
      setImagePreview(nextPreview);
      setFormData((prev) => ({ ...prev, image: file }));
    },
    [onError]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;

      const errors = validateBookForm(formData, { mode });
      if (errors.length > 0) {
        onError(errors.join(". "));
        return;
      }

      const payload = normalizeBookPayload(formData, mode);
      onSubmit(payload);
    },
    [formData, mode, onError, onSubmit, submitting]
  );

  const isReadOnly = mode === "update";
  const bookTypeLabel = BOOK_TYPES.find((o) => o.value === formData.book_type)?.label ?? formData.book_type;
  const countryLabel = meta.countries.find((c) => String(c.id) === formData.country)?.name ?? formData.country;

  return (
    <form
      className={`${styles.form} ${isReadOnly ? styles.formUpdate : ""}`}
      onSubmit={handleSubmit}
      aria-label={mode === "create" ? "Створення книги" : "Оновлення книги"}
    >
      <div className={styles.gridTwo}>
        <Field label="Назва мовою оригіналу" readOnly={isReadOnly}>
          {isReadOnly ? (
            <div className={styles.inputReadonly} aria-readonly>{formData.title || "—"}</div>
          ) : (
            <input
              className={styles.input}
              placeholder="Назва мовою оригіналу"
              value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
            />
          )}
        </Field>
        <Field
          label="Назва мовою перекладу"
          hint="*у разі авторського твору — повторити назву"
          readOnly={isReadOnly}
        >
          {isReadOnly ? (
            <div className={styles.inputReadonly} aria-readonly>{formData.title_en || "—"}</div>
          ) : (
            <input
              className={styles.input}
              placeholder="Назва мовою перекладу"
              value={formData.title_en}
              onChange={(e) => setFormData((p) => ({ ...p, title_en: e.target.value }))}
            />
          )}
        </Field>
      </div>

      <div className={styles.selectRow}>
        {isReadOnly ? (
          <PillDisplay label="Тип твору" value={bookTypeLabel} />
        ) : (
          <PillSelect
            label="Тип твору"
            value={formData.book_type}
            options={BOOK_TYPES}
            onChange={handleBookTypeChange}
          />
        )}
        <Field label="Автор твору" readOnly={isReadOnly}>
          {isReadOnly ? (
            <div className={styles.inputReadonly} aria-readonly>{formData.author || "—"}</div>
          ) : (
            <input
              className={styles.input}
              placeholder="..."
              value={formData.author}
              onChange={(e) => setFormData((p) => ({ ...p, author: e.target.value }))}
            />
          )}
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
            options={translationStatusOptions}
            onChange={(v) => setFormData((p) => ({ ...p, translation_status: v }))}
          />
        )}
        {isReadOnly ? (
          <PillDisplay label="Країна твору" value={countryLabel} />
        ) : (
          <PillSelect
            label="Країна твору"
            value={formData.country}
            options={meta.countries.map((c) => ({ value: String(c.id), label: c.name }))}
            onChange={(v) => setFormData((p) => ({ ...p, country: v }))}
          />
        )}
      </div>

      <div className={styles.descGrid}>
        <Field label="Опис / рецензія">
          <textarea
            className={styles.textarea}
            placeholder="Напишіть будь ласка опис/рецензію до цього твору..."
            value={formData.description}
            maxLength={DESCRIPTION_MAX_CHARS}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          />
          {formData.description && (
            <div className={styles.hint} style={{ marginTop: 4 }}>
              {formData.description.length}/{DESCRIPTION_MAX_CHARS} символів
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
          {meta.genres.map((g) => (
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
          <ShowMoreNavigation
            className={styles.centerRow}
            visibleCount={tagGroupsVisibleCount}
            totalCount={meta.tagGroups.length}
            onShowMore={showMoreTagGroups}
            ariaLabel="Показати ще теги"
          />
        </div>
      </Panel>

      <Panel title="Фендом">
        <div className={styles.fandomGrid}>
          <div className={styles.fandomChipsWrap}>
            {meta.fandoms.map((f) => (
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
          disabled={submitting}
          ariaLabel={submitLabel}
        >
          {submitting ? "Збереження…" : submitLabel}
        </ActionButton>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  readOnly,
  children,
}: {
  label: string;
  hint?: string;
  readOnly?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`${styles.field} ${readOnly ? styles.fieldReadonly : ""}`}>
      <div className={styles.fieldHead}>
        <span className={styles.fieldPill}>{label}</span>
        {hint ? <span className={styles.fieldHintInline}>{hint}</span> : null}
      </div>

      <div className={styles.fieldBody}>{children}</div>
    </label>
  );
}

function PillDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.pillDisplay}>
      <div className={styles.pillLabel}>{label}</div>
      <div className={styles.pillDisplayValue} aria-readonly>{value || "—"}</div>
    </div>
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
      <div className={styles.pillFrame}>
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
