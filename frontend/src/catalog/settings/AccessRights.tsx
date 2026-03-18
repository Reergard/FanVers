import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { SaveButton } from "../../shared/SaveButton/SaveButton";
import { useNotification } from "../../shared/NotificationModal/NotificationProvider";
import { extractUserMessage } from "../../shared/utils/errorUtils";
import styles from "./AccessRights.module.css";
import type { BookAccessRights, PermissionLevel } from "./accessRights.types";
import { ACCESS_RIGHTS_FIELDS, ACCESS_RIGHTS_LEVELS } from "./accessRights.config";
import { useBookAccessRights } from "./hooks/useBookAccessRights";
import { useUpdateBookAccessRights } from "./hooks/useUpdateBookAccessRights";

export default function AccessRights() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { showSuccess, showError } = useNotification();
  const {
    data: accessRights,
    isLoading,
    isError,
    error,
  } = useBookAccessRights(slug);
  const updateMutation = useUpdateBookAccessRights(slug);

  const [form, setForm] = useState<BookAccessRights | null>(null);

  useEffect(() => {
    if (accessRights) {
      setForm({
        view_permission: accessRights.view_permission ?? "all",
        comment_book_permission: accessRights.comment_book_permission ?? "all",
        comment_chapter_permission: accessRights.comment_chapter_permission ?? "all",
        download_permission: accessRights.download_permission ?? "all",
        rate_permission: accessRights.rate_permission ?? "all",
      });
    }
  }, [accessRights]);

  const handleChange = (key: keyof BookAccessRights, nextValue: PermissionLevel) => {
    setForm((prev) => (prev ? { ...prev, [key]: nextValue } : null));
  };

  const handleSubmit = () => {
    if (!slug) {
      showError("Не вдалося визначити книгу");
      return;
    }
    if (!form) {
      showError("Дані ще не завантажені");
      return;
    }

    updateMutation.mutate(form, {
      onSuccess: () => {
        showSuccess("Налаштування доступу успішно збережено");
      },
      onError: (err) => {
        showError(extractUserMessage(err, "Помилка при збереженні налаштувань доступу"));
      },
    });
  };

  if (!slug) return null;

  if (isLoading) {
    return (
      <section className={styles.section} aria-labelledby="access-rights-title">
        <div className={styles.panel}>
          <p className={styles.loading}>Завантаження налаштувань доступу…</p>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className={styles.section} aria-labelledby="access-rights-title">
        <div className={styles.panel}>
          <p className={styles.errorText} role="alert">
            {extractUserMessage(error, "Не вдалося завантажити налаштування доступу")}
          </p>
        </div>
      </section>
    );
  }

  if (!form) {
    return (
      <section className={styles.section} aria-labelledby="access-rights-title">
        <div className={styles.panel}>
          <p className={styles.loading}>Завантаження налаштувань доступу…</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="access-rights-title">
      <div className={styles.panel}>
        <h2 id="access-rights-title" className={styles.title}>
          Права доступу
        </h2>

        {/* Desktop / tablet table */}
        <div className={styles.tableWrap}>
          <div
            className={styles.table}
            role="table"
            aria-label="Права доступу до книги"
          >
            <div
              className={styles.headRowWrap}
              role="row"
              aria-label="Заголовки колонок"
            >
              <div
                className={`${styles.cell} ${styles.headCell} ${styles.actionCell}`}
                role="columnheader"
              >
                Що можуть робити
              </div>
              {ACCESS_RIGHTS_LEVELS.map((level) => (
                <div
                  key={level.value}
                  className={`${styles.cell} ${styles.headCell} ${styles.optionCell}`}
                  role="columnheader"
                >
                  {level.label}
                </div>
              ))}
            </div>

            <div className={styles.body} role="rowgroup">
              {ACCESS_RIGHTS_FIELDS.map((field) => (
                <div key={field.key} className={styles.dataRow} role="row">
                  <div
                    className={`${styles.cell} ${styles.actionCell}`}
                    role="rowheader"
                  >
                    {field.label}
                  </div>

                  {ACCESS_RIGHTS_LEVELS.map((level) => {
                    const inputId = `${field.key}-${level.value}`;
                    return (
                      <div
                        key={level.value}
                        className={`${styles.cell} ${styles.optionCell}`}
                        role="cell"
                      >
                        <label
                          htmlFor={inputId}
                          className={styles.checkboxLabel}
                          aria-label={`${field.label}: ${level.label}`}
                        >
                          <input
                            id={inputId}
                            className={styles.checkboxInput}
                            type="radio"
                            name={field.key}
                            checked={form[field.key] === level.value}
                            onChange={() => handleChange(field.key, level.value)}
                          />
                          <span className={styles.checkboxUi} aria-hidden="true" />
                        </label>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile cards */}
        <div className={styles.mobileList}>
          {ACCESS_RIGHTS_FIELDS.map((field) => (
            <article key={field.key} className={styles.mobileCard}>
              <h3 className={styles.mobileCardTitle}>{field.label}</h3>

              <div className={styles.mobileOptions}>
                {ACCESS_RIGHTS_LEVELS.map((level) => {
                  const inputId = `mobile-${field.key}-${level.value}`;
                  const isChecked = form[field.key] === level.value;
                  return (
                    <label
                      key={level.value}
                      htmlFor={inputId}
                      className={styles.mobileOption}
                      data-selected={isChecked ? "true" : undefined}
                    >
                      <span className={styles.mobileOptionText}>
                        {level.label}
                      </span>
                      <span className={styles.mobileOptionInputWrap}>
                        <input
                          id={inputId}
                          className={styles.checkboxInput}
                          type="radio"
                          name={`mobile-${field.key}`}
                          checked={form[field.key] === level.value}
                          onChange={() => handleChange(field.key, level.value)}
                        />
                        <span
                          className={styles.checkboxUi}
                          aria-hidden="true"
                        />
                      </span>
                    </label>
                  );
                })}
              </div>
            </article>
          ))}
        </div>

        <div className={styles.actions}>
          <SaveButton
            className={styles.saveButton}
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Збереження…" : "Зберегти"}
          </SaveButton>
        </div>
      </div>
    </section>
  );
}
