import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios, { AxiosError } from "axios";
import { Container } from "../../shared/Container";
import { Breadcrumb } from "../../navigation/Breadcrumb";
import { PageTitle } from "../../navigation/PageTitle";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import { http } from "../../api/http";
import { API } from "../../api/endpoints";
import { fetchCsrfToken } from "../../auth/csrf";
import { useAuth } from "../../auth/useAuth";
import { getMyProfile } from "../../users/profileService";
import styles from "./HelpPages.module.css";

const CATEGORY_OPTIONS = [
  { value: "", label: "Виберіть тип звернення" },
  { value: "technical", label: "Технічна проблема" },
  { value: "payment", label: "Питання по платежам" },
  { value: "content", label: "Питання по контенту" },
  { value: "account", label: "Проблеми з акаунтом" },
  { value: "other", label: "Інше" },
] as const;

const MAX_FILES = 3;
const ACCEPT_FILES = ".pdf,.jpg,.jpeg,.png,.webp";

type FieldErrors = Partial<Record<"category" | "subject" | "message" | "name" | "email" | "attachments", string>>;

function formatApiErrors(data: unknown): { form?: string; fields: FieldErrors } {
  const fields: FieldErrors = {};
  if (!data || typeof data !== "object") {
    return { fields };
  }
  const d = data as Record<string, unknown>;
  if (typeof d.error === "string") {
    return { form: d.error, fields };
  }
  if (typeof d.detail === "string") {
    return { form: d.detail, fields };
  }
  if (Array.isArray(d.detail)) {
    return { form: d.detail.map(String).join(" "), fields };
  }
  const map: (keyof FieldErrors)[] = [
    "category",
    "subject",
    "message",
    "name",
    "email",
    "attachments",
  ];
  for (const key of map) {
    const v = d[key];
    if (Array.isArray(v) && typeof v[0] === "string") {
      fields[key] = v[0];
    } else if (typeof v === "string") {
      fields[key] = v;
    }
  }
  return { fields };
}

export default function SupportPage() {
  const { authReady, isAuthenticated, username } = useAuth();
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  /** true лише після успішного getMyProfile; при помилці завантаження — false (не блокуємо сабміт на клієнті). */
  const [profileLoadedOk, setProfileLoadedOk] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [honeypot, setHoneypot] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [successTicket, setSuccessTicket] = useState<string | null>(null);

  useEffect(() => {
    void fetchCsrfToken();
  }, []);

  useEffect(() => {
    if (!authReady || !isAuthenticated) {
      setProfileEmail(null);
      setProfileLoadedOk(false);
      return;
    }
    let cancelled = false;
    setProfileLoadedOk(false);
    void (async () => {
      try {
        const p = await getMyProfile();
        if (!cancelled) {
          setProfileEmail(p.email || "");
          setProfileLoadedOk(true);
        }
      } catch {
        if (!cancelled) {
          setProfileEmail(null);
          setProfileLoadedOk(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated]);

  const resetFormAfterSuccess = useCallback(() => {
    setCategory("");
    setSubject("");
    setMessage("");
    setHoneypot("");
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (!isAuthenticated) {
      setName("");
      setEmail("");
    }
  }, [isAuthenticated]);

  const validateClient = useCallback((): FieldErrors => {
    const err: FieldErrors = {};
    if (!category) {
      err.category = "Оберіть тип звернення.";
    }
    if (subject.trim().length < 3) {
      err.subject = "Тема має бути не коротшою за 3 символи.";
    }
    if (message.trim().length < 20) {
      err.message = "Опишіть проблему детальніше (мінімум 20 символів).";
    }
    if (!isAuthenticated) {
      if (!name.trim()) {
        err.name = "Вкажіть ім'я або нік.";
      }
      if (!email.trim()) {
        err.email = "Вкажіть email для відповіді.";
      }
    }
    if (files.length > MAX_FILES) {
      err.attachments = `Не більше ${MAX_FILES} файлів.`;
    }
    return err;
  }, [category, subject, message, name, email, isAuthenticated, files.length]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    if (list.length > MAX_FILES) {
      setFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setFieldErrors((prev) => ({
        ...prev,
        attachments: `Оберіть не більше ${MAX_FILES} файлів.`,
      }));
      return;
    }
    setFiles(list);
    setFieldErrors((prev) => ({ ...prev, attachments: undefined }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setFieldErrors({});
    setSuccessTicket(null);

    const clientErr = validateClient();
    if (Object.keys(clientErr).length > 0) {
      setFieldErrors(clientErr);
      return;
    }

    if (isAuthenticated && profileLoadedOk && !(profileEmail ?? "").trim()) {
      setFormError("У профілі не вказано email. Додайте email у налаштуваннях профілю.");
      return;
    }

    await fetchCsrfToken();

    setSubmitting(true);
    try {
      const pageUrl =
        typeof window !== "undefined" ? window.location.href.slice(0, 500) : "";

      const hasFiles = files.length > 0;
      if (hasFiles) {
        const fd = new FormData();
        fd.append("category", category);
        fd.append("subject", subject.trim());
        fd.append("message", message.trim());
        fd.append("website", honeypot);
        fd.append("page_url", pageUrl);
        if (!isAuthenticated) {
          fd.append("name", name.trim());
          fd.append("email", email.trim());
        }
        for (const f of files) {
          fd.append("attachments", f);
        }
        const { data } = await http.post<{ ticket_number: string; message: string }>(
          API.supportTickets,
          fd
        );
        setSuccessTicket(data.ticket_number);
        resetFormAfterSuccess();
      } else {
        const body: Record<string, string> = {
          category,
          subject: subject.trim(),
          message: message.trim(),
          website: honeypot,
          page_url: pageUrl,
        };
        if (!isAuthenticated) {
          body.name = name.trim();
          body.email = email.trim();
        }
        const { data } = await http.post<{ ticket_number: string; message: string }>(
          API.supportTickets,
          body
        );
        setSuccessTicket(data.ticket_number);
        resetFormAfterSuccess();
      }
    } catch (raw) {
      const err = raw as AxiosError<unknown>;
      const status = err.response?.status;
      const { form, fields } = formatApiErrors(err.response?.data);
      if (Object.keys(fields).length > 0) {
        setFieldErrors(fields);
      }
      if (form) {
        setFormError(form);
      } else if (status === 429) {
        setFormError("Занадто багато спроб. Зачекайте трохи й спробуйте ще раз.");
      } else if (axios.isAxiosError(err) && err.code === "ERR_NETWORK") {
        setFormError("Немає зв'язку з сервером. Перевірте з'єднання.");
      } else if (!form && !Object.keys(fields).length) {
        setFormError("Не вдалося надіслати звернення. Спробуйте пізніше.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.page}>
      <Container>
        <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Написати у підтримку" }]} />
        <div className={styles.content}>
          <PageTitle>Написати у підтримку</PageTitle>

          <article className={styles.card}>
            {successTicket ? (
              <div className={styles.successWrap}>
                <p className={styles.successBox} role="status">
                  Звернення прийнято. Номер для звернення:
                  <span className={styles.successTicket}>{successTicket}</span>
                </p>
                <ActionButton
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSuccessTicket(null);
                    setFormError(null);
                    setFieldErrors({});
                  }}
                  ariaLabel="Нове звернення"
                >
                  Нове звернення
                </ActionButton>
              </div>
            ) : (
              <>
                {formError && (
                  <p className={styles.formError} role="alert">
                    {formError}
                  </p>
                )}

                <form className={styles.form} onSubmit={onSubmit}>
              <div className={styles.field}>
                <label htmlFor="support-category" className={styles.label}>
                  Тип звернення
                </label>
                <select
                  id="support-category"
                  className={styles.control}
                  value={category}
                  onChange={(ev) => setCategory(ev.target.value)}
                  required
                  aria-invalid={!!fieldErrors.category}
                  aria-describedby={fieldErrors.category ? "support-category-err" : undefined}
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value || "empty"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.category && (
                  <p id="support-category-err" className={styles.fieldError}>
                    {fieldErrors.category}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="support-subject" className={styles.label}>
                  Коротка тема
                </label>
                <input
                  id="support-subject"
                  type="text"
                  className={styles.control}
                  value={subject}
                  onChange={(ev) => setSubject(ev.target.value)}
                  placeholder="Наприклад: не відкривається глава після оплати"
                  maxLength={255}
                  autoComplete="off"
                  aria-invalid={!!fieldErrors.subject}
                  aria-describedby={fieldErrors.subject ? "support-subject-err" : undefined}
                />
                {fieldErrors.subject && (
                  <p id="support-subject-err" className={styles.fieldError}>
                    {fieldErrors.subject}
                  </p>
                )}
              </div>

              {!isAuthenticated && (
                <>
                  <div className={styles.field}>
                    <label htmlFor="support-name" className={styles.label}>
                      Ваше ім&apos;я або нік
                    </label>
                    <input
                      id="support-name"
                      type="text"
                      className={styles.control}
                      value={name}
                      onChange={(ev) => setName(ev.target.value)}
                      autoComplete="name"
                      aria-invalid={!!fieldErrors.name}
                      aria-describedby={fieldErrors.name ? "support-name-err" : undefined}
                    />
                    {fieldErrors.name && (
                      <p id="support-name-err" className={styles.fieldError}>
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="support-email" className={styles.label}>
                      Ваш email
                    </label>
                    <input
                      id="support-email"
                      type="email"
                      className={styles.control}
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      placeholder="example@email.com"
                      autoComplete="email"
                      aria-invalid={!!fieldErrors.email}
                      aria-describedby={fieldErrors.email ? "support-email-err" : undefined}
                    />
                    {fieldErrors.email && (
                      <p id="support-email-err" className={styles.fieldError}>
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>
                </>
              )}

              {isAuthenticated && (
                <div className={styles.field}>
                  <span className={styles.label}>Нік</span>
                  <p className={styles.control} style={{ margin: 0 }}>
                    {username || "—"}
                  </p>
                  <p className={styles.hint}>Береться з вашого облікового запису, змінити тут неможливо.</p>
                  <span className={styles.label} style={{ display: "block", marginTop: 12 }}>
                    Контактний email
                  </span>
                  <p className={styles.control} style={{ margin: 0 }}>
                    {!profileLoadedOk ? "…" : profileEmail || "—"}
                  </p>
                  <p className={styles.hint}>Використовується email з вашого профілю.</p>
                </div>
              )}

              <div className={styles.field}>
                <label htmlFor="support-message" className={styles.label}>
                  Повідомлення
                </label>
                <textarea
                  id="support-message"
                  rows={6}
                  className={styles.control}
                  value={message}
                  onChange={(ev) => setMessage(ev.target.value)}
                  placeholder="Опишіть вашу проблему детально..."
                  maxLength={8000}
                  aria-invalid={!!fieldErrors.message}
                  aria-describedby={fieldErrors.message ? "support-message-err" : undefined}
                />
                {fieldErrors.message && (
                  <p id="support-message-err" className={styles.fieldError}>
                    {fieldErrors.message}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="support-files" className={styles.label}>
                  Вкладення (необов&apos;язково)
                </label>
                <input
                  ref={fileInputRef}
                  id="support-files"
                  type="file"
                  className={styles.control}
                  accept={ACCEPT_FILES}
                  multiple
                  onChange={onFileChange}
                  aria-invalid={!!fieldErrors.attachments}
                />
                <p className={styles.fileHint}>
                  До {MAX_FILES} файлів: PDF, JPG, PNG, WEBP. Максимум 5 МБ кожен.
                </p>
                {fieldErrors.attachments && (
                  <p className={styles.fieldError}>{fieldErrors.attachments}</p>
                )}
              </div>

              {/* Honeypot: не заповнювати (боти часто заповнюють «website»). */}
              <div className={styles.visuallyHidden} aria-hidden="true">
                <label htmlFor="support-website">Website</label>
                <input
                  id="support-website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(ev) => setHoneypot(ev.target.value)}
                />
              </div>

              <ActionButton
                type="submit"
                variant="primary"
                loading={submitting}
                disabled={submitting}
                ariaLabel="Надіслати звернення"
              >
                Надіслати звернення
              </ActionButton>
            </form>
              </>
            )}
          </article>

          <div className={`${styles.cardSoft} ${styles.quickHelp}`}>
            <h2 className={styles.quickHelpTitle}>Швидка допомога</h2>
            <p className={styles.text}>
              Перед зверненням перевірте розділ FAQ — можливо, там вже є відповідь на ваше питання.
              Перейти до довідки можна тут:{" "}
              <Link to="/balance-help" className={styles.link}>
                Не поповнився баланс?
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
