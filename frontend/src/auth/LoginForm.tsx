import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import magicBallSvg from "../assets/icons/magic_ball.svg";
import { Icon } from "../shared/Icon";
import { AuthModalContent } from "./AuthModalContent";
import { SocialLoginButton } from "./SocialLoginButton";
import { loginSession } from "./service";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { extractUserMessage, logDeveloperError } from "../shared/utils/errorUtils";
import { resendActivation } from "./activationApi";
import { PasswordInput } from "./PasswordInput";
import styles from "./AuthForms.module.css";

type Props = {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
};

export function LoginForm({ onSuccess, onSwitchToRegister }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inactiveHint, setInactiveHint] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const notification = useNotification();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setTimeout(() => {
      setResendCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => window.clearTimeout(t);
  }, [resendCooldown]);

  const handleResendActivation = async () => {
    const email = window.prompt("Введіть email, який ви використовували при реєстрації:");
    if (!email) return;

    setResendLoading(true);
    try {
      await resendActivation(email.trim());
      notification.showSuccess(
        "Якщо такий email існує і ще не активований — лист надіслано повторно."
      );
      setResendCooldown(60);
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 429) {
        notification.showError("Занадто багато запитів. Спробуйте пізніше.");
      } else {
        notification.showError("Не вдалося надіслати лист. Спробуйте пізніше.");
      }
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setInactiveHint(false);

    try {
      await loginSession({ username, password, remember_me: rememberMe });
      notification.showSuccess("Успішний вхід!");
      onSuccess?.();
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { detail?: string } } };
      if (err?.response?.status === 403) {
        setInactiveHint(true);
        notification.showError(
          err.response?.data?.detail ??
            "Акаунт не активовано. Перевірте пошту та підтвердіть email."
        );
        return;
      }
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
          <PasswordInput
            id="login-password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
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

        <div className={styles.forgotPasswordRow}>
          <Link to="/password/reset" className={styles.forgotPasswordLink}>
            Забули пароль?
          </Link>
        </div>

        {inactiveHint && (
          <div className={styles.inactiveAccountBanner}>
            <p className={styles.inactiveAccountText}>
              Ваш акаунт не активовано. Перевірте пошту (зокрема «Спам»).
            </p>
            <button
              type="button"
              onClick={handleResendActivation}
              disabled={resendLoading || resendCooldown > 0}
              className={styles.inactiveAccountBtn}
            >
              {resendLoading
                ? "Відправка..."
                : resendCooldown > 0
                  ? `Повторна відправка через ${resendCooldown}с`
                  : "Надіслати лист повторно"}
            </button>
          </div>
        )}

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

        {onSwitchToRegister ? (
          <p className={styles.switchAuthRow}>
            <span className={styles.switchAuthText}>Незареєстровані? Тоді </span>
            <button
              type="button"
              className={styles.switchAuthLink}
              onClick={onSwitchToRegister}
            >
              зареєструйтеся
            </button>
          </p>
        ) : null}
      </form>
    </AuthModalContent>
  );
}
