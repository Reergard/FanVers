import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Modal } from "../shared/Modal/Modal";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import styles from "./Profile.module.css";
import {
  createPayoutMethod,
  createPayoutProfile,
  submitPayoutProfile,
  updatePayoutProfile,
} from "./payoutService";
import type { PayoutProfile } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingProfile?: PayoutProfile | null;
};

const LEGAL_OPTIONS = [
  { value: "individual", label: "Фізособа" },
  { value: "fop_ua", label: "ФОП (Україна)" },
  { value: "self_employed_other", label: "Самозайнятий (інша країна)" },
  { value: "legal_entity", label: "Юр. особа" },
];

export function PayoutSetupModal({
  open,
  onClose,
  onSuccess,
  existingProfile,
}: Props) {
  const { showSuccess, showError } = useNotification();
  const isEdit = Boolean(existingProfile?.id);

  const [legalStatus, setLegalStatus] = useState(
    existingProfile?.legal_status ?? "individual"
  );
  const [country, setCountry] = useState(existingProfile?.country ?? "UA");
  const [taxResidency, setTaxResidency] = useState(
    existingProfile?.tax_residency_country ?? "UA"
  );
  const [taxId, setTaxId] = useState(existingProfile?.tax_id ?? "");
  const [fullNameLegal, setFullNameLegal] = useState(
    existingProfile?.full_name_legal ?? ""
  );
  const [fullNameLatin, setFullNameLatin] = useState(
    existingProfile?.full_name_latin ?? ""
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const profilePayload = {
        legal_status: legalStatus,
        country: country.toUpperCase().slice(0, 2),
        tax_residency_country: taxResidency.toUpperCase().slice(0, 2),
        tax_id: taxId,
        full_name_legal: fullNameLegal.trim(),
        full_name_latin: fullNameLatin.trim(),
        address_line: addressLine.trim(),
        city: city.trim(),
        postal_code: postalCode.trim(),
      };

      if (isEdit) {
        await updatePayoutProfile(profilePayload);
      } else {
        await createPayoutProfile(profilePayload);
        if (iban.trim()) {
          await createPayoutMethod({
            iban: iban.replace(/\s/g, "").toUpperCase(),
            bic_swift: bic.trim(),
            recipient_full_name: recipientName.trim() || fullNameLatin.trim(),
            currency: "UAH",
          });
        }
      }
      await submitPayoutProfile();
    },
    onSuccess: () => {
      showSuccess(
        "Профіль виплат подано на перевірку. Після схвалення ви зможете запитувати виплати."
      );
      onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { error?: unknown } } })?.response
        ?.data?.error;
      const msg =
        typeof data === "string"
          ? data
          : "Помилка збереження профілю виплат";
      showError(msg);
    },
  });

  const handleSubmit = () => {
    if (!fullNameLegal.trim() || !fullNameLatin.trim() || !addressLine.trim()) {
      showError("Заповніть обов'язкові поля профілю");
      return;
    }
    if (!isEdit && !iban.trim()) {
      showError("Вкажіть IBAN для виплат");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Профіль виплат">
      <div className={styles.modalForm}>
        <p className={styles.modalHint}>
          Дані для виплат через Wise. Після перевірки адміністратором ви зможете
          запитувати виведення FanCoins.
        </p>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Юридичний статус</span>
          <span className={styles.fieldBox}>
            <select
              className={styles.input}
              value={legalStatus}
              onChange={(e) => setLegalStatus(e.target.value)}
            >
              {LEGAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </span>
        </label>

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
          <span className={styles.fieldLabel}>Податкове резидентство</span>
          <span className={styles.fieldBox}>
            <input
              className={styles.input}
              value={taxResidency}
              maxLength={2}
              onChange={(e) => setTaxResidency(e.target.value)}
            />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Податковий ID</span>
          <span className={styles.fieldBox}>
            <input
              className={styles.input}
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
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
          <span className={styles.fieldLabel}>ПІБ латиницею</span>
          <span className={styles.fieldBox}>
            <input
              className={styles.input}
              value={fullNameLatin}
              onChange={(e) => setFullNameLatin(e.target.value)}
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
          </>
        )}

        <button
          type="button"
          className={styles.btnGreen}
          onClick={handleSubmit}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Збереження..." : "Подати на перевірку"}
        </button>
      </div>
    </Modal>
  );
}
