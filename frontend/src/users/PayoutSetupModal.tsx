import { useState, useMemo, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Modal } from "../shared/Modal/Modal";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { useAuth } from "../auth/useAuth";
import styles from "./Profile.module.css";
import {
  createPayoutMethod,
  createPayoutProfile,
  getPayoutMethods,
  getPayoutProfile,
  submitPayoutProfile,
  updatePayoutProfile,
} from "./payoutService";
import type { PayoutProfile } from "./types";
import { detectCurrencyByIban, SUPPORTED_CURRENCIES } from "./ibanCurrency";
import { extractApiError } from "./payoutErrors";

const MIN_PAYOUT_COINS = 1000;

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingProfile?: PayoutProfile | null;
};

export function PayoutSetupModal({
  open,
  onClose,
  onSuccess,
  existingProfile,
}: Props) {
  const { showSuccess, showError } = useNotification();
  const { balance } = useAuth();
  const balanceNum = parseFloat(balance ?? "0") || 0;
  const isEdit = Boolean(
    existingProfile?.id &&
      existingProfile.verification_status !== "draft" &&
      existingProfile.verification_status !== "cancelled" &&
      existingProfile.verification_status !== "rejected" &&
      existingProfile.verification_status !== "requires_more_info"
  );

  const [country, setCountry] = useState(existingProfile?.country ?? "UA");
  const [fullNameLegal, setFullNameLegal] = useState(
    existingProfile?.full_name_legal ?? ""
  );
  const [addressLine, setAddressLine] = useState(
    existingProfile?.address_line ?? ""
  );
  const [city, setCity] = useState(existingProfile?.city ?? "");
  const [postalCode, setPostalCode] = useState(existingProfile?.postal_code ?? "");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [recipientName, setRecipientName] = useState(
    existingProfile?.full_name_latin ?? ""
  );
  const [currencyOverride, setCurrencyOverride] = useState<string | null>(null);
  const [showCurrencySelect, setShowCurrencySelect] = useState(false);
  const [coinsAmount, setCoinsAmount] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (open) {
      setCountry(existingProfile?.country ?? "UA");
      setFullNameLegal(existingProfile?.full_name_legal ?? "");
      setAddressLine(existingProfile?.address_line ?? "");
      setCity(existingProfile?.city ?? "");
      setPostalCode(existingProfile?.postal_code ?? "");
      setRecipientName(existingProfile?.full_name_latin ?? "");
      setIban("");
      setBic("");
      setCurrencyOverride(null);
      setShowCurrencySelect(false);
      setCoinsAmount("");
      setIsUrgent(false);
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [open, existingProfile]);

  const detectedCurrency = useMemo(() => detectCurrencyByIban(iban), [iban]);
  const currency = currencyOverride ?? detectedCurrency ?? "UAH";

  const saveMutation = useMutation({
    mutationFn: async () => {
      const profilePayload = {
        country: country.toUpperCase().slice(0, 2),
        full_name_legal: fullNameLegal.trim(),
        full_name_latin: recipientName.trim(),
        address_line: addressLine.trim(),
        city: city.trim(),
        postal_code: postalCode.trim(),
      };

      if (isEdit) {
        await updatePayoutProfile(profilePayload);
      } else {
        const existing = await getPayoutProfile();
        if (
          ("exists" in existing && !existing.exists) ||
          ("verification_status" in existing && existing.verification_status === "cancelled")
        ) {
          await createPayoutProfile(profilePayload);
        } else {
          await updatePayoutProfile(profilePayload);
        }
        if (iban.trim()) {
          const existingMethods = await getPayoutMethods();
          if (!existingMethods || existingMethods.length === 0) {
            await createPayoutMethod({
              iban: iban.replace(/\s/g, "").toUpperCase(),
              bic_swift: bic.trim(),
              recipient_full_name: recipientName.trim(),
              currency,
            });
          }
        }
      }
      const amt = Math.floor(Number(coinsAmount));
      await submitPayoutProfile(amt, idempotencyKey, isUrgent);
    },
    onSuccess: () => {
      showSuccess(
        "Заявку на виплату подано. Очікуйте перевірки — зазвичай це займає до 3 робочих днів."
      );
      onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      showError(extractApiError(err, "Помилка збереження заявки на виплату"));
    },
  });

  const handleSubmit = () => {
    if (!country.trim()) {
      showError("Вкажіть країну (ISO код, наприклад UA)");
      return;
    }
    if (!fullNameLegal.trim()) {
      showError("Вкажіть ПІБ рідною мовою");
      return;
    }
    if (!recipientName.trim()) {
      showError("Вкажіть ім'я отримувача латиницею");
      return;
    }
    if (!addressLine.trim()) {
      showError("Вкажіть адресу");
      return;
    }
    if (!city.trim()) {
      showError("Вкажіть місто");
      return;
    }
    if (!postalCode.trim()) {
      showError("Вкажіть поштовий індекс");
      return;
    }
    if (!isEdit && !iban.trim()) {
      showError("Вкажіть IBAN для виплат");
      return;
    }
    const amt = Number(coinsAmount);
    if (!amt || !Number.isInteger(amt) || amt < MIN_PAYOUT_COINS) {
      showError(`Введіть цілу суму (мінімум ${MIN_PAYOUT_COINS} FanCoins)`);
      return;
    }
    if (amt > balanceNum) {
      showError("Недостатньо коштів на балансі");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Заявка на виплату через Wise">
      <div className={styles.modalForm}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Країна (ISO)</span>
          <span className={styles.fieldBox}>
            <input
              className={styles.input}
              value={country}
              maxLength={2}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="UA"
            />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>ПІБ (рідною мовою)</span>
          <span className={styles.fieldBox}>
            <input
              className={styles.input}
              value={fullNameLegal}
              onChange={(e) => setFullNameLegal(e.target.value)}
            />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Ім&apos;я отримувача (латиницею)</span>
          <span className={styles.fieldBox}>
            <input
              className={styles.input}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Ivan Petrenko"
            />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Адреса</span>
          <span className={styles.fieldBox}>
            <input
              className={styles.input}
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
            />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Місто</span>
          <span className={styles.fieldBox}>
            <input
              className={styles.input}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Поштовий індекс</span>
          <span className={styles.fieldBox}>
            <input
              className={styles.input}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </span>
        </label>

        {!isEdit && (
          <>
            <hr />
            <p className={styles.modalHint}>Реквізити банку (IBAN)</p>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>IBAN</span>
              <span className={styles.fieldBox}>
                <input
                  className={styles.input}
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  autoComplete="off"
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
                      <option key={c} value={c}>{c}</option>
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
          </>
        )}

        <hr />
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Сума виведення (FanCoins)
          </span>
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
        <p className={styles.modalHint} style={{ fontSize: "0.82em", opacity: 0.7, marginTop: 0 }}>
          Конвертація у валюту вашого рахунку відбувається за курсом Wise на момент
          відправлення коштів, а не подачі заявки.
        </p>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            padding: "10px 12px",
            borderRadius: "8px",
            background: isUrgent ? "rgba(240, 173, 78, 0.12)" : "rgba(255,255,255,0.04)",
            border: isUrgent ? "1px solid rgba(240, 173, 78, 0.4)" : "1px solid rgba(255,255,255,0.1)",
            marginBottom: "8px",
            transition: "all 0.2s",
          }}
        >
          <input
            type="checkbox"
            checked={isUrgent}
            onChange={(e) => setIsUrgent(e.target.checked)}
            style={{ width: "18px", height: "18px", accentColor: "#f0ad4e", cursor: "pointer" }}
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
            <div style={{ display: "flex", justifyContent: "space-between", color: "#f0ad4e" }}>
              <span>Комісія (10%):</span>
              <span>−{Math.floor(Number(coinsAmount) * 0.1)} FanCoins</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
              <span>До виплати:</span>
              <span>{Math.floor(Number(coinsAmount) - Number(coinsAmount) * 0.1)} FanCoins</span>
            </div>
          </div>
        )}

        <p className={styles.modalHint} style={{ fontSize: "0.82em", opacity: 0.7, marginTop: 0 }}>
          {isUrgent
            ? "Термінова заявка буде оброблена протягом 1–3 робочих днів."
            : "Після схвалення заявки кошти надходять протягом 1–14 робочих днів залежно від банку та країни отримувача."}
        </p>

        <button
          type="button"
          className={styles.btnGreen}
          onClick={handleSubmit}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Збереження..." : "Надіслати заявку"}
        </button>
      </div>
    </Modal>
  );
}
