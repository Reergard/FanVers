import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { httpRaw } from "../api/httpRaw";
import { API } from "../api/endpoints";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { extractUserMessage, logDeveloperError } from "../shared/utils/errorUtils";
import styles from "./AuthForms.module.css";

/**
 * Підтвердження нового логіну за посиланням з листа djoser.
 */
export function UsernameResetConfirmPage() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const navigate = useNavigate();
  const notification = useNotification();
  const [newUsername, setNewUsername] = useState("");
  const [reUsername, setReUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !token) {
      notification.showError("Невірне посилання.");
      return;
    }
    if (newUsername !== reUsername) {
      notification.showError("Логіни не співпадають");
      return;
    }
    setLoading(true);
    try {
      await httpRaw.post(API.resetUsernameConfirm, {
        uid,
        token,
        new_username: newUsername,
        re_new_username: reUsername,
      });
      notification.showSuccess("Логін змінено. Увійдіть з новим логіном.");
      navigate("/", { replace: true });
    } catch (error: unknown) {
      logDeveloperError("UsernameResetConfirmPage", error);
      notification.showError(extractUserMessage(error, "Не вдалося змінити логін"));
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
      <h1 style={{ fontSize: "1.5rem", marginBottom: 16 }}>Новий логін</h1>
      <form onSubmit={handleSubmit} className={styles.form} autoComplete="on">
        <div className={styles.field}>
          <label htmlFor="new-user" className={styles.label}>
            Новий логін
          </label>
          <input
            id="new-user"
            name="new_username"
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            required
            autoComplete="username"
            className={styles.input}
            disabled={loading}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="re-user" className={styles.label}>
            Підтвердження логіну
          </label>
          <input
            id="re-user"
            name="re_new_username"
            type="text"
            value={reUsername}
            onChange={(e) => setReUsername(e.target.value)}
            required
            autoComplete="username"
            className={styles.input}
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
            {loading ? "Збереження…" : "Зберегти логін"}
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
