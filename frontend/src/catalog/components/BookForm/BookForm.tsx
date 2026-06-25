import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
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
import { PillDropdownSelect } from "../../../shared/PillDropdownSelect/PillDropdownSelect";
import styles from "./BookForm.module.css";
import {
  createEmptyExtraImageSlots,
  revokeExtraImagePreviews,
  slotDisplayUrl,
  slotHasVisibleImage,
  type ExtraImageSlot,
} from "./bookFormExtraImages.utils";
import { UploadCloudIcon } from "../BookExtraImages/UploadCloudIcon";
import panelStyles from "../BookExtraImages/BookExtraImagesPanel.module.css";

export const BOOK_TYPES = [
  { value: "TRANSLATION" as const, label: "Переклад" },
  { value: "AUTHOR" as const, label: "Авторський" },
];

export const TRANSLATION_STATUSES = [
  { value: "TRANSLATING", label: "Перекладається" },
  { value: "WAITING", label: "В очікуванні розділів" },
  { value: "COMPLETED", label: "Завершено" },
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
  extraImages: ExtraImageSlot[];
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
  extraImages: createEmptyExtraImageSlots(),
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
  onSubmit: (
    payload: CreateBookPayload | UpdateBookPayload,
    context: { extraImages: ExtraImageSlot[] }
  ) => void | Promise<void>;
  onError: (msg: string) => void;
  /** Лише mode="create": роль для обмежень «Створити книгу» */
  bookCreationProfileRole?: string | null;
  bookCreationProfileLoading?: boolean;
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

export function BookForm({
  mode,
  initialValues,
  initialImagePreview = null,
  meta,
  submitLabel,
  submitting,
  onSubmit,
  onError,
  bookCreationProfileRole,
  bookCreationProfileLoading = false,
}: BookFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extraFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
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
      revokeExtraImagePreviews(formData.extraImages);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup лише при unmount
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

  const handleExtraImageChange = useCallback(
    (index: number, file: File | null) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        onError("Будь ласка, завантажте зображення (image/png або image/jpeg)");
        return;
      }
      if (file.size > IMAGE_MAX_SIZE) {
        onError(`Розмір файлу не повинен перевищувати ${BOOK_COVER_MAX_MB} МБ`);
        return;
      }

      setFormData((prev) => {
        const slots = [...prev.extraImages];
        const prevSlot = slots[index];
        if (prevSlot.preview) {
          URL.revokeObjectURL(prevSlot.preview);
        }
        slots[index] = {
          file,
          preview: URL.createObjectURL(file),
          existing: prevSlot.existing,
          markedForDelete: false,
        };
        return { ...prev, extraImages: slots };
      });
    },
    [onError]
  );

  const handleExtraImageRemove = useCallback((index: number) => {
    setFormData((prev) => {
      const slots = [...prev.extraImages];
      const slot = slots[index];
      if (slot.preview) {
        URL.revokeObjectURL(slot.preview);
      }
      if (slot.existing) {
        slots[index] = {
          file: null,
          preview: null,
          existing: slot.existing,
          markedForDelete: true,
        };
      } else {
        slots[index] = {
          file: null,
          preview: null,
          existing: null,
          markedForDelete: false,
        };
      }
      return { ...prev, extraImages: slots };
    });
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;

      if (mode === "create") {
        if (bookCreationProfileLoading) return;
        if (bookCreationProfileRole === "Читач") return;
        if (bookCreationProfileRole === "Перекладач" && formData.book_type === "AUTHOR") return;
      }

      const errors = validateBookForm(formData, { mode });
      if (errors.length > 0) {
        onError(errors.join(". "));
        return;
      }

      const payload = normalizeBookPayload(formData, mode);
      void Promise.resolve(onSubmit(payload, { extraImages: formData.extraImages }));
    },
    [
      formData,
      mode,
      onError,
      onSubmit,
      submitting,
      bookCreationProfileLoading,
      bookCreationProfileRole,
    ]
  );

  const isReadOnly = mode === "update";
  const readerCreateBlocked =
    mode === "create" && bookCreationProfileRole === "Читач";
  const translatorAuthorBlocked =
    mode === "create" &&
    bookCreationProfileRole === "Перекладач" &&
    formData.book_type === "AUTHOR";
  const createSubmitDisabled =
    mode === "create" &&
    (bookCreationProfileLoading || readerCreateBlocked || translatorAuthorBlocked);
  const bookTypeLabel = BOOK_TYPES.find((o) => o.value === formData.book_type)?.label ?? formData.book_type;
  const countryLabel = meta.countries.find((c) => String(c.id) === formData.country)?.name ?? formData.country;

  return (
    <form
      className={`${styles.form} ${isReadOnly ? styles.formUpdate : ""}`}
      onSubmit={handleSubmit}
      aria-label={mode === "create" ? "Створення книги" : "Оновлення книги"}
    >
      <div className={styles.gridTwo}>
        <Field label="Назва українською" readOnly={isReadOnly}>
          {isReadOnly ? (
            <div className={styles.inputReadonly} aria-readonly>{formData.title || "—"}</div>
          ) : (
            <input
              className={styles.input}
              placeholder="Назва українською"
              value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
            />
          )}
        </Field>
        <Field
          label="Назва мовою оригіналу"
          hint="*у разі авторського твору — повторити назву українською"
          readOnly={isReadOnly}
        >
          {isReadOnly ? (
            <div className={styles.inputReadonly} aria-readonly>{formData.title_en || "—"}</div>
          ) : (
            <input
              className={styles.input}
              placeholder="Назва мовою оригіналу"
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
        <section className={`${styles.imagePanel} ${panelStyles.panel}`} aria-label="Додаткові зображення">
          <div className={panelStyles.panelTitlePill}>Додаткові зображення</div>
          <div className={panelStyles.extraImagesRow}>
            {formData.extraImages.map((slot, index) => {
              const displayUrl = slotDisplayUrl(slot);
              const hasImage = slotHasVisibleImage(slot);

              return (
                <div
                  key={index}
                  className={`${panelStyles.extraSlot} ${panelStyles.extraSlotInteractive}`}
                >
                  {hasImage && displayUrl ? (
                    <>
                      <img
                        src={displayUrl}
                        alt={`Додаткове зображення ${index + 1}`}
                        className={panelStyles.extraSlotImage}
                      />
                      <button
                        type="button"
                        className={panelStyles.extraSlotReplace}
                        onClick={() => extraFileInputRefs.current[index]?.click()}
                        aria-label={`Замінити зображення ${index + 1}`}
                      />
                      <button
                        type="button"
                        className={panelStyles.extraSlotRemove}
                        onClick={() => handleExtraImageRemove(index)}
                        aria-label={`Видалити зображення ${index + 1}`}
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={panelStyles.extraSlotLabel}
                      onClick={() => extraFileInputRefs.current[index]?.click()}
                      aria-label={`Вибрати зображення ${index + 1}`}
                    >
                      <UploadCloudIcon className={panelStyles.uploadIconSmall} size={51} />
                    </button>
                  )}
                  <input
                    ref={(el) => {
                      extraFileInputRefs.current[index] = el;
                    }}
                    type="file"
                    accept="image/png,image/jpeg"
                    className={panelStyles.srOnly}
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      handleExtraImageChange(index, file);
                      e.target.value = "";
                    }}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {readerCreateBlocked ? (
        <div className={styles.roleNotice} role="alert">
          <p className={styles.roleNoticeText}>
            Читачі не можуть створювати книги. Щоб отримати це право, змініть тип профілю на сторінці{" "}
            <Link to="/profile" className={styles.roleNoticeLink}>
              Профіль
            </Link>
            .
          </p>
        </div>
      ) : null}
      {translatorAuthorBlocked ? (
        <div className={styles.roleNotice} role="status">
          <p className={styles.roleNoticeText}>
            Ми з радістю вітаємо авторські твори на платформі! Публікувати твір з типом «Авторський» можуть лише
            літератори. Змініть тип профілю на сторінці{" "}
            <Link to="/profile" className={styles.roleNoticeLink}>
              Профіль
            </Link>
            .
          </p>
        </div>
      ) : null}
      <div className={styles.submitRow}>
        <ActionButton
          type="submit"
          variant="bookFrame"
          disabled={submitting || createSubmitDisabled}
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
      {hint ? <p className={styles.fieldHintBelow}>{hint}</p> : null}
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
      <div className={`${styles.pillFrame} ${styles.pillFrameWithDropdown}`}>
        <PillDropdownSelect
          variant="form"
          value={value}
          options={options.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => onChange(v as T)}
          ariaLabel={label}
          placeholder="Оберіть"
        />
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
