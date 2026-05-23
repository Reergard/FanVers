import { Modal } from "../shared/Modal/Modal";
import styles from "./Profile.module.css";
import {
  PAYOUT_PROFILE_STATUS_COLORS,
  PAYOUT_PROFILE_STATUS_LABELS,
} from "./payoutLabels";
import type { PayoutMethod, PayoutProfile } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelectWise: () => void;
  /** Existing payout methods (for returning users) */
  existingMethods?: PayoutMethod[];
  /** KYC-профіль — для блоку «раніше використовували» */
  payoutProfile?: PayoutProfile | null;
  /**
   * Показувати раніше використані способи після відправки batch у Wise
   * (хоча б один запит у статусі processing / completed / failed).
   */
  showPreviouslyUsed?: boolean;
  /** Opens withdraw modal with the chosen method (no dropdown) */
  onSelectExistingMethod?: (method: PayoutMethod) => void;
};

export function PayoutMethodSelectModal({
  open,
  onClose,
  onSelectWise,
  existingMethods = [],
  payoutProfile = null,
  showPreviouslyUsed = false,
  onSelectExistingMethod,
}: Props) {
  const seenIbans = new Set<string>();
  const dedupeMethods = (list: PayoutMethod[]) =>
    list.filter((m) => {
      const key = m.iban_masked ?? String(m.id);
      if (seenIbans.has(key)) return false;
      seenIbans.add(key);
      return true;
    });

  const usedMethods = dedupeMethods(
    existingMethods.filter((m) => m.is_active && m.used_in_payouts === true)
  );

  // Якщо бекенд ще не позначив used_in_payouts — показуємо активні методи
  seenIbans.clear();
  const methodsToShow =
    usedMethods.length > 0
      ? usedMethods
      : dedupeMethods(existingMethods.filter((m) => m.is_active));

  const showUsedSection =
    showPreviouslyUsed &&
    payoutProfile != null &&
    methodsToShow.length > 0 &&
    onSelectExistingMethod != null;

  return (
    <Modal open={open} onClose={onClose} title="Спосіб виплати">
      <div className={styles.modalForm}>
        <p className={styles.modalHint}>
          Наразі доступна виплата лише через Wise. Ми працюємо над додаванням
          інших способів отримання коштів.
        </p>

        <button
          type="button"
          className={styles.payoutMethodBtn}
          onClick={() => {
            onClose();
            onSelectWise();
          }}
        >
          <span
            className={styles.payoutMethodLogo}
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontWeight: 700,
              fontSize: "1.3em",
              color: "#9fe870",
              letterSpacing: "-0.5px",
            }}
            aria-label="Wise"
          >
            wise
          </span>
          <span className={styles.payoutMethodInfo}>
            <strong>Wise</strong>
            <span className={styles.payoutMethodDesc}>
              Міжнародні перекази на банківський рахунок (IBAN)
            </span>
          </span>
        </button>

        {showUsedSection && (
          <div style={{ marginTop: "16px" }}>
            <p
              style={{
                fontSize: "0.9em",
                opacity: 0.7,
                margin: "0 0 8px",
                fontWeight: 600,
              }}
            >
              Способи які ви раніше використовували:
            </p>
            {methodsToShow.map((m) => (
              <button
                key={m.id}
                type="button"
                className={styles.payoutMethodBtn}
                style={{
                  marginBottom: "6px",
                  width: "100%",
                  textAlign: "left",
                }}
                onClick={() => {
                  onClose();
                  onSelectExistingMethod(m);
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                    width: "100%",
                  }}
                >
                  <div>
                    <strong>Заявка на виплати</strong>
                    <br />
                    <span style={{ fontSize: "0.85em", opacity: 0.7 }}>
                      {payoutProfile.full_name_latin} · {payoutProfile.country}
                      {m.iban_masked ? ` · ${m.iban_masked}` : ""}
                    </span>
                  </div>
                  <span
                    style={{
                      color:
                        PAYOUT_PROFILE_STATUS_COLORS[
                          payoutProfile.verification_status
                        ] ?? "#ccc",
                      fontWeight: 600,
                      fontSize: "0.9em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {PAYOUT_PROFILE_STATUS_LABELS[
                      payoutProfile.verification_status
                    ] ?? payoutProfile.verification_status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
