import React, { useState } from "react";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import magicBallSvg from "../assets/icons/magic_ball.svg";
import { Icon } from "../shared/Icon";
import { AuthModalContent } from "./AuthModalContent";
import { SocialLoginButton } from "./SocialLoginButton";
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
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const notification = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await loginSession({ username, password, remember_me: rememberMe });
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
    <AuthModalContent>
      <form onSubmit={handleSubmit} className={styles.form} autoComplete="on">
        <div className={styles.field}>
          <label htmlFor="login-username" className={styles.label}>
            Логін:
          </label>
          <input
            id="login-username"
            name="username"
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
            Пароль:
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={styles.input}
            disabled={loading}
          />
        </div>

        <div className={styles.rememberRow}>
          <button
            type="button"
            className={styles.checkboxBtn}
            onClick={() => setRememberMe(!rememberMe)}
            aria-label="Запам'ятати мене"
            aria-pressed={rememberMe}
          >
            <Icon
              name={rememberMe ? "content_checkbox_checked" : "content_checkbox"}
              aria-hidden
            />
          </button>
          <span className={styles.rememberLabel} onClick={() => setRememberMe(!rememberMe)}>
            Запам'ятати мене
          </span>
        </div>

        <div className={styles.actions}>
          <ActionButton
            type="submit"
            disabled={loading}
            ariaLabel="Увійти"
            className={styles.submitButton}
          >
            {loading ? "Вхід..." : "УВІЙТИ"}
          </ActionButton>
        </div>

        <div className={styles.orDivider}>
          <span className={styles.orText}>або</span>
        </div>

        <div className={styles.socialButtons}>
          <SocialLoginButton provider="facebook" label="Facebook" />
          <div className={styles.magicSphere} aria-hidden>
            <img src={magicBallSvg} alt="" width={40} height={50} />
          </div>
          <SocialLoginButton provider="google" label="Google" />
        </div>
      </form>
    </AuthModalContent>
  );
}
