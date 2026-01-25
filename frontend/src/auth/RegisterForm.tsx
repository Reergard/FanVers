import React, { useState } from "react";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { registerSession } from "./service";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { extractUserMessage, logDeveloperError } from "../shared/utils/errorUtils";
import styles from "./AuthForms.module.css";

type Props = {
  onSuccess?: () => void;
};

export function RegisterForm({ onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const notification = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== rePassword) {
      notification.showError("Паролі не співпадають");
      return;
    }

    setLoading(true);

    try {
      await registerSession({ username, email, password, re_password: rePassword });
      notification.showSuccess("Реєстрація успішна! Ви увійшли в систему.");
      onSuccess?.();
    } catch (error: unknown) {
      logDeveloperError("RegisterForm", error);
      const userMessage = extractUserMessage(error, "Помилка реєстрації");
      notification.showError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="register-username" className={styles.label}>
          Ім'я користувача
        </label>
        <input
          id="register-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          className={styles.input}
          disabled={loading}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="register-email" className={styles.label}>
          Email
        </label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={styles.input}
          disabled={loading}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="register-password" className={styles.label}>
          Пароль
        </label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          className={styles.input}
          disabled={loading}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="register-re-password" className={styles.label}>
          Підтвердження пароля
        </label>
        <input
          id="register-re-password"
          type="password"
          value={rePassword}
          onChange={(e) => setRePassword(e.target.value)}
          required
          autoComplete="new-password"
          className={styles.input}
          disabled={loading}
        />
      </div>

      <div className={styles.actions}>
        <ActionButton
          type="submit"
          disabled={loading}
          ariaLabel="Зареєструватися"
          className={styles.submitButton}
        >
          {loading ? "Реєстрація..." : "Зареєструватися"}
        </ActionButton>
      </div>
    </form>
  );
}
