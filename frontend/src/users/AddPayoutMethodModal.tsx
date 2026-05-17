import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../shared/Modal/Modal";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { createPayoutMethod } from "./payoutService";
import styles from "./Profile.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: number | null;
};

export function AddPayoutMethodModal({ open, onClose, userId }: Props) {
  const { showSuccess, showError } = useNotification();
  const queryClient = useQueryClient();

  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [recipientName, setRecipientName] = useState("");

  const addMutation = useMutation({
    mutationFn: () =>
      createPayoutMethod({
        iban: iban.replace(/\s/g, "").toUpperCase(),
        bic_swift: bic.trim() || undefined,
        recipient_full_name: recipientName.trim(),
        currency: "UAH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payoutMethods", userId] });
      showSuccess("Метод виплати додано");
      setIban("");
      setBic("");
      setRecipientName("");
      onClose();
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error ?? "Помилка при додаванні методу");
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
    addMutation.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Додати метод виплати">
      <div className={styles.modalForm}>
        <p className={styles.modalHint}>
          Додайте новий IBAN для виплат через Wise.
        </p>
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
        <button
          type="button"
          className={styles.btnGreen}
          onClick={handleSubmit}
          disabled={addMutation.isPending}
        >
          {addMutation.isPending ? "Збереження..." : "Додати"}
        </button>
      </div>
    </Modal>
  );
}
