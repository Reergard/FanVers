import { useEffect, useRef, useState, type FormEvent } from "react";
import { Modal } from "../shared/Modal/Modal";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { extractUserMessage } from "../shared/utils/errorUtils";
import { refreshAuthStatus } from "../auth/service";
import { useAuth } from "../auth/useAuth";
import { sendAuthorThanks } from "../api/authorThanksApi";
import styles from "./ModalThankAuthor.module.css";

const MIN_FANCOINS = 20;
const MAX_FANCOINS = 10_000;

export type ModalThankAuthorProps = {
  open: boolean;
  onClose: () => void;
  /** Передається лише з BookHero при наявному id; перевірка на кшталт !bookId || bookId <= 0 на сабміті */
  bookId?: number | null;
  bookTitle: string;
};

function normalizeAmount(raw: string): string {
  return raw.trim().replace(",", ".").replace(/\s+/g, "");
}

/** Парсинг балансу з auth store; може не збігатися з сервером (інша вкладка, затримка оновлення). */
function parseBalanceUk(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function parseAmount(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const s = normalizeAmount(raw);
  if (!s) return { ok: false, error: "Введіть суму." };
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return { ok: false, error: "Допустимо до двох знаків після коми." };
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "Невірна сума." };
  if (n < MIN_FANCOINS) {
    return { ok: false, error: `Мінімальна сума — ${MIN_FANCOINS} FanCoins.` };
  }
  if (n > MAX_FANCOINS) {
    return { ok: false, error: `Максимальна сума — ${MAX_FANCOINS.toLocaleString("uk-UA")} FanCoins.` };
  }
  return { ok: true, value: n.toFixed(2) };
}

export function ModalThankAuthor({ open, onClose, bookId, bookTitle }: ModalThankAuthorProps) {
  const { showSuccess, showError } = useNotification();
  const { balance } = useAuth();
  const [amountInput, setAmountInput] = useState(String(MIN_FANCOINS));
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const idempotencyKeyRef = useRef("");

  useEffect(() => {
    if (open) {
      idempotencyKeyRef.current = crypto.randomUUID();
      setAmountInput(String(MIN_FANCOINS));
      setSubmitting(false);
      submitLockRef.current = false;
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseAmount(amountInput);
    if (!parsed.ok) {
      showError(parsed.error);
      return;
    }
    if (bookId == null || !Number.isFinite(bookId) || bookId <= 0) {
      showError("Немає ідентифікатора книги. Оновіть сторінку.");
      return;
    }

    const amountNum = Number(parsed.value);
    const balNum = parseBalanceUk(balance);
    // Лише UX: джерело правди — бекенд; застарілий баланс обробляється відповіддю API.
    if (balNum !== null && amountNum > balNum) {
      showError(
        `Недостатньо коштів на балансі. Потрібно ${parsed.value}, доступно ${balNum.toFixed(2)} FanCoins.`
      );
      return;
    }

    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    const idem = idempotencyKeyRef.current || crypto.randomUUID();
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = idem;
    try {
      const res = await sendAuthorThanks({
        book_id: bookId,
        amount: parsed.value,
        idempotency_key: idem,
      });
      await refreshAuthStatus();
      showSuccess(
        res.duplicate ? "Цей запит уже було оброблено раніше." : "Подяку надіслано власнику книги. Дякуємо!"
      );
      onClose();
    } catch (err) {
      showError(extractUserMessage(err, "Не вдалося надіслати подяку."));
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Подякувати автора / перекладача">
      <form className={styles.form} onSubmit={handleSubmit}>
        <p className={styles.intro}>
          Ви можете підтримати власника цієї книги (автора оригіналу або перекладача) будь-якою сумою в FanCoins.
        </p>
        <p className={styles.intro}>
          Мінімальна сума — <strong>{MIN_FANCOINS}</strong> FanCoins, максимальна —{" "}
          {MAX_FANCOINS.toLocaleString("uk-UA")} FanCoins.
        </p>
        {balance != null && balance !== "" ? (
          <p className={styles.balance}>Ваш баланс: {balance} FanCoins</p>
        ) : null}
        <p className={styles.balance}>
          <strong>{bookTitle}</strong>
        </p>

        <label className={styles.amountLabel}>
          Сума (FanCoins)
          <input
            className={styles.input}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            name="thank_amount"
            value={amountInput}
            onChange={(ev) => setAmountInput(ev.target.value)}
            aria-describedby="thank-amount-hint"
          />
        </label>
        <p id="thank-amount-hint" className={styles.hint}>
          Використовуйте крапку або кому для копійок (наприклад, 50 або 50,50).
        </p>

        <div className={styles.actions}>
          <ActionButton type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Скасувати
          </ActionButton>
          <ActionButton type="submit" variant="primary" loading={submitting} disabled={submitting}>
            Підтвердити
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}
