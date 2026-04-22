import React, { useState } from "react";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { Icon } from "../shared/Icon";
import magicBallSvg from "../assets/icons/magic_ball.svg";
import { AuthModalContent } from "./AuthModalContent";
import { SocialLoginButton } from "./SocialLoginButton";
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
  const [rememberMe, setRememberMe] = useState(false);
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
      const result = await registerSession({
        username,
        email,
        password,
        re_password: rePassword,
        remember_me: rememberMe,
      });
      if (result?.access) {
        notification.showSuccess("Реєстрація успішна! Ви увійшли в систему.");
      } else {
        notification.showSuccess(
          result?.detail ||
            "Реєстрація успішна! Для завершення реєстрації перевірте пошту та підтвердіть email."
        );
      }
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
    <AuthModalContent>
    <form onSubmit={handleSubmit} className={styles.form} autoComplete="on">
      <div className={styles.field}>
        <label htmlFor="register-username" className={styles.label}>
          Ім'я користувача
        </label>
        <input
          id="register-username"
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
        <label htmlFor="register-email" className={styles.label}>
          Email
        </label>
        <input
          id="register-email"
          name="email"
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
          name="password"
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
          name="password_confirm"
          type="password"
          value={rePassword}
          onChange={(e) => setRePassword(e.target.value)}
          required
          autoComplete="new-password"
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
          ariaLabel="Зареєструватися"
          className={styles.submitButton}
        >
          {loading ? "Реєстрація..." : "Зареєструватися"}
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
