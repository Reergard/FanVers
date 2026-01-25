import React, { useState } from "react";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { loginSession } from "./service";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { extractUserMessage, logDeveloperError } from "../shared/utils/errorUtils";
import styles from "./AuthForms.module.css";

type Props = {
  onSuccess?: () => void;
};

export function LoginForm({ onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const notification = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await loginSession({ username, password });
      notification.showSuccess("Успішний вхід!");
      onSuccess?.();
    } catch (error: unknown) {
      logDeveloperError("LoginForm", error);
      const userMessage = extractUserMessage(error, "Помилка входу");
      notification.showError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="login-username" className={styles.label}>
          Ім'я користувача
        </label>
        <input
          id="login-username"
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
        <label htmlFor="login-password" className={styles.label}>
          Пароль
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className={styles.input}
          disabled={loading}
        />
      </div>

      <div className={styles.actions}>
        <ActionButton
          type="submit"
          disabled={loading}
          ariaLabel="Увійти"
          className={styles.submitButton}
        >
          {loading ? "Вхід..." : "Увійти"}
        </ActionButton>
      </div>
    </form>
  );
}
