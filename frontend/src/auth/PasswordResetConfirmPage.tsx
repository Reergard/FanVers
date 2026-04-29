import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { httpRaw } from "../api/httpRaw";
import { API } from "../api/endpoints";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { extractUserMessage, logDeveloperError } from "../shared/utils/errorUtils";
import { PasswordInput } from "./PasswordInput";
import styles from "./AuthForms.module.css";

/**
 * Підтвердження нового пароля за посиланням з листа djoser.
 */
export function PasswordResetConfirmPage() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const navigate = useNavigate();
  const notification = useNotification();
  const [newPassword, setNewPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !token) {
      notification.showError("Невірне посилання.");
      return;
    }
    if (newPassword !== rePassword) {
      notification.showError("Паролі не співпадають");
      return;
    }
    setLoading(true);
    try {
      await httpRaw.post(API.resetPasswordConfirm, {
        uid,
        token,
        new_password: newPassword,
        re_new_password: rePassword,
      });
      notification.showSuccess("Пароль змінено. Увійдіть з новим паролем.");
      navigate("/", { replace: true });
    } catch (error: unknown) {
      logDeveloperError("PasswordResetConfirmPage", error);
      notification.showError(extractUserMessage(error, "Не вдалося змінити пароль"));
    } finally {
      setLoading(false);
    }
  };

  const wrap: React.CSSProperties = {
    padding: "48px 24px",
    maxWidth: 440,
    margin: "0 auto",
    color: "rgba(255,255,255,0.9)",
  };

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 16 }}>Новий пароль</h1>
      <form onSubmit={handleSubmit} className={styles.form} autoComplete="on">
        <div className={styles.field}>
          <label htmlFor="new-pw" className={styles.label}>
            Новий пароль
          </label>
          <PasswordInput
            id="new-pw"
            name="new_password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            disabled={loading}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="re-pw" className={styles.label}>
            Підтвердження пароля
          </label>
          <PasswordInput
            id="re-pw"
            name="re_new_password"
            value={rePassword}
            onChange={(e) => setRePassword(e.target.value)}
            required
            autoComplete="new-password"
            disabled={loading}
          />
        </div>
        <div className={styles.actions}>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 20px",
              borderRadius: 999,
              border: "1px solid rgba(5, 180, 199, 0.5)",
              background: "rgba(5, 180, 199, 0.25)",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {loading ? "Збереження…" : "Зберегти пароль"}
          </button>
        </div>
      </form>
      <p style={{ marginTop: 24 }}>
        <Link to="/" style={{ color: "rgba(5, 180, 199, 0.95)" }}>
          На головну
        </Link>
      </p>
    </div>
  );
}
