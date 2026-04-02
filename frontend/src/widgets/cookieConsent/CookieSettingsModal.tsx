import { useEffect, useState } from "react";
import { Modal } from "../../shared/Modal/Modal";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import type { CookieConsent } from "../../settings/cookieConsentStore";
import styles from "./CookieConsentManager.module.css";

export function CookieSettingsModal(props: {
  open: boolean;
  saving: boolean;
  consent: CookieConsent | null;
  onClose: () => void;
  onSave: (next: { preferences: boolean; analytics: boolean }) => void;
}) {
  const [draft, setDraft] = useState({
    preferences: props.consent?.preferences ?? false,
    analytics: props.consent?.analytics ?? false,
  });

  useEffect(() => {
    setDraft({
      preferences: props.consent?.preferences ?? false,
      analytics: props.consent?.analytics ?? false,
    });
  }, [props.consent?.preferences, props.consent?.analytics]);

  return (
    <Modal open={props.open} onClose={props.onClose} title="Налаштування cookies">
      <div className={styles.modalBody}>
        <p className={styles.modalHint}>
          Необхідні cookies завжди увімкнені. Ви можете керувати лише необовʼязковими категоріями.
        </p>

        <div className={styles.switchList}>
          <label className={styles.switchRow}>
            <input type="checkbox" checked disabled />
            <div className={styles.switchText}>
              <div className={styles.switchTitle}>Necessary</div>
              <div className={styles.switchDesc}>
                Логін/сесії, CSRF, безпека, anti-fraud, збереження вибору.
              </div>
            </div>
          </label>

          <label className={styles.switchRow}>
            <input
              type="checkbox"
              checked={draft.preferences}
              onChange={(e) => setDraft((d) => ({ ...d, preferences: e.target.checked }))}
              disabled={props.saving}
            />
            <div className={styles.switchText}>
              <div className={styles.switchTitle}>Preferences</div>
              <div className={styles.switchDesc}>Необовʼязкові UI-налаштування та зручності.</div>
            </div>
          </label>

          <label className={styles.switchRow}>
            <input
              type="checkbox"
              checked={draft.analytics}
              onChange={(e) => setDraft((d) => ({ ...d, analytics: e.target.checked }))}
              disabled={props.saving}
            />
            <div className={styles.switchText}>
              <div className={styles.switchTitle}>Analytics</div>
              <div className={styles.switchDesc}>
                Дозвіл на необовʼязкові зовнішні аналітичні скрипти (якщо вони зʼявляться).
              </div>
            </div>
          </label>
        </div>

        <div className={styles.modalActions}>
          <ActionButton
            variant="primary"
            onClick={() => props.onSave(draft)}
            disabled={props.saving}
            loading={props.saving}
          >
            Зберегти
          </ActionButton>
          <ActionButton variant="outline" onClick={props.onClose} disabled={props.saving}>
            Скасувати
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
}

