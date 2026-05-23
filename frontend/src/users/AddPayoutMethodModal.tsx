import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../shared/Modal/Modal";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { createPayoutMethod } from "./payoutService";
import { withdrawBalance } from "./profileService";
import { detectCurrencyByIban, SUPPORTED_CURRENCIES } from "./ibanCurrency";
import { extractApiError } from "./payoutErrors";
import styles from "./Profile.module.css";

const MIN_PAYOUT_COINS = 1000;

type Props = {
  open: boolean;
  onClose: () => void;
  userId: number | null;
  /** Called after a new method is successfully added (simple mode only) */
  onMethodAdded?: (methodId: number) => void;
  /** Combined mode: create method + payout request in one flow */
  withWithdraw?: boolean;
  /** User balance string (needed for withWithdraw mode) */
  balance?: string | number;
  /** Called after successful payout request creation in combined mode */
  onWithdrawSuccess?: () => void;
};

export function AddPayoutMethodModal({
  open,
  onClose,
  userId,
  onMethodAdded,
  withWithdraw,
  balance,
  onWithdrawSuccess,
}: Props) {
  const { showSuccess, showError } = useNotification();
  const queryClient = useQueryClient();

  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [currencyOverride, setCurrencyOverride] = useState<string | null>(null);
  const [showCurrencySelect, setShowCurrencySelect] = useState(false);
  // Withdraw fields (combined mode)
  const [coinsAmount, setCoinsAmount] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (open) {
      setIban("");
      setBic("");
      setRecipientName("");
      setCurrencyOverride(null);
      setShowCurrencySelect(false);
      setCoinsAmount("");
      setIsUrgent(false);
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [open]);

  const detectedCurrency = useMemo(() => detectCurrencyByIban(iban), [iban]);
  const currency = currencyOverride ?? detectedCurrency ?? "UAH";
  const balanceNum = parseFloat(String(balance ?? "0")) || 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const newMethod = await createPayoutMethod({
        iban: iban.replace(/\s/g, "").toUpperCase(),
        bic_swift: bic.trim() || undefined,
        recipient_full_name: recipientName.trim(),
        currency,
      });
      if (withWithdraw) {
        const amt = Math.floor(Number(coinsAmount));
        await withdrawBalance(amt, newMethod.id, idempotencyKey, isUrgent);
      }
      return newMethod;
    },
    onSuccess: (newMethod) => {
      queryClient.invalidateQueries({ queryKey: ["payoutMethods", userId] });
      if (withWithdraw) {
        queryClient.invalidateQueries({ queryKey: ["payoutRequests", userId] });
        showSuccess("Запит на виплату створено");
        onClose();
        onWithdrawSuccess?.();
      } else {
        showSuccess("Метод виплати додано");
        onClose();
        onMethodAdded?.(newMethod.id);
      }
    },
    onError: (err: unknown) => {
      showError(
        extractApiError(
          err,
          withWithdraw
            ? "Помилка при створенні запиту на виплату"
            : "Помилка при додаванні методу"
        )
      );
    },
  });

  const handleSubmit = () => {
    if (!iban.trim()) {
      showError("Вкажіть IBAN");
      return;
    }
    if (!recipientName.trim()) {
      showError("Вкажіть ім'я отримувача");
      return;
    }
    if (withWithdraw) {
      const amt = Number(coinsAmount);
      if (!amt || !Number.isInteger(amt) || amt < MIN_PAYOUT_COINS) {
        showError(`Введіть цілу суму (мінімум ${MIN_PAYOUT_COINS} FanCoins)`);
        return;
      }
      if (amt > balanceNum) {
        showError("Недостатньо коштів на балансі");
        return;
      }
    }
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={withWithdraw ? "Запросити виплату через Wise" : "Додати метод виплати"}
    >
      <div className={styles.modalForm}>
        {!withWithdraw && (
          <p className={styles.modalHint}>
            Додайте новий IBAN для виплат через Wise.
          </p>
        )}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>IBAN</span>
          <span className={styles.fieldBox}>
            <input
              className={styles.input}
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              autoComplete="off"
              placeholder="UA21..."
            />
          </span>
        </label>
        {detectedCurrency && (
          <div className={styles.currencyAutoDetect}>
            <span>
              Валюта виплати: <strong>{currency}</strong>
              {!currencyOverride && " (визначено автоматично)"}
            </span>
            {!showCurrencySelect ? (
              <button
                type="button"
                className={styles.currencyChangeLink}
                onClick={() => setShowCurrencySelect(true)}
              >
                У разі якщо валюта вашого рахунку інша, натисніть аби змінити
              </button>
            ) : (
              <select
                className={styles.input}
                value={currency}
                onChange={(e) => {
                  setCurrencyOverride(e.target.value);
                  setShowCurrencySelect(false);
                }}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>BIC/SWIFT (необов&apos;язково)</span>
          <span className={styles.fieldBox}>
            <input
              className={styles.input}
              value={bic}
              onChange={(e) => setBic(e.target.value)}
            />
          </span>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Ім&apos;я отримувача в банку</span>
          <span className={styles.fieldBox}>
            <input
              className={styles.input}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </span>
        </label>

        {withWithdraw && (
          <>
            <hr />
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Сума виведення (FanCoins)</span>
              <span className={styles.fieldBox}>
                <input
                  className={styles.input}
                  type="number"
                  min={MIN_PAYOUT_COINS}
                  max={balanceNum}
                  value={coinsAmount}
                  onChange={(e) => setCoinsAmount(e.target.value)}
                  placeholder={String(MIN_PAYOUT_COINS)}
                />
              </span>
            </label>
            <p className={styles.modalHint} style={{ marginTop: 0 }}>
              Доступно: {balance ?? 0} FanCoins · Мінімум: {MIN_PAYOUT_COINS}
            </p>
            <p
              className={styles.modalHint}
              style={{ fontSize: "0.82em", opacity: 0.7, marginTop: 0 }}
            >
              Конвертація у валюту вашого рахунку відбувається за курсом Wise на
              момент відправлення коштів, а не подачі заявки.
            </p>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                padding: "10px 12px",
                borderRadius: "8px",
                background: isUrgent
                  ? "rgba(240, 173, 78, 0.12)"
                  : "rgba(255,255,255,0.04)",
                border: isUrgent
                  ? "1px solid rgba(240, 173, 78, 0.4)"
                  : "1px solid rgba(255,255,255,0.1)",
                marginBottom: "8px",
                transition: "all 0.2s",
              }}
            >
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                style={{
                  width: "18px",
                  height: "18px",
                  accentColor: "#f0ad4e",
                  cursor: "pointer",
                }}
              />
              <span style={{ flex: 1 }}>
                <strong style={{ color: isUrgent ? "#f0ad4e" : "inherit" }}>
                  ⚡ Терміновий вивід
                </strong>
                <br />
                <span style={{ fontSize: "0.82em", opacity: 0.7 }}>
                  Комісія 10% · обробка 1–3 дні
                </span>
              </span>
            </label>

            {coinsAmount && Number(coinsAmount) > 0 && isUrgent && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.04)",
                  fontSize: "0.88em",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "#f0ad4e",
                  }}
                >
                  <span>Комісія (10%):</span>
                  <span>
                    −{Math.floor(Number(coinsAmount) * 0.1)} FanCoins
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 600,
                  }}
                >
                  <span>До виплати:</span>
                  <span>
                    {Math.floor(
                      Number(coinsAmount) - Number(coinsAmount) * 0.1
                    )}{" "}
                    FanCoins
                  </span>
                </div>
              </div>
            )}

            <p
              className={styles.modalHint}
              style={{ fontSize: "0.82em", opacity: 0.7, marginTop: 0 }}
            >
              {isUrgent
                ? "Термінова заявка буде оброблена протягом 1–3 робочих днів."
                : "Після схвалення заявки кошти надходять протягом 1–14 робочих днів залежно від банку та країни отримувача."}
            </p>
          </>
        )}

        <button
          type="button"
          className={withWithdraw ? styles.btnRed : styles.btnGreen}
          onClick={handleSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? "Збереження..."
            : withWithdraw
              ? "Запросити виплату"
              : "Додати"}
        </button>
      </div>
    </Modal>
  );
}
