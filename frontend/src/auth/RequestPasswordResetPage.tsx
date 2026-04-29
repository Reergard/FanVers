import { useState } from "react";
import { Link } from "react-router-dom";
import { httpRaw } from "../api/httpRaw";
import { API } from "../api/endpoints";
import styles from "./AuthForms.module.css";

/**
 * Запит листа з посиланням для скидання пароля (лист з djoser).
 */
export function RequestPasswordResetPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await httpRaw.post(API.resetPassword, { email });
    } catch {
      // Не розкриваємо, чи існує email
    } finally {
      setLoading(false);
      setDone(true);
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
      <h1 style={{ fontSize: "1.5rem", marginBottom: 16 }}>Скидання пароля</h1>
      {done ? (
        <p style={{ lineHeight: 1.6 }}>
          Якщо такий email зареєстрований, ми надіслали лист із посиланням. Перевірте пошту (зокрема
          «Спам»).
        </p>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form} autoComplete="on">
          <div className={styles.field}>
            <label htmlFor="reset-email" className={styles.label}>
              Email
            </label>
            <input
              id="reset-email"
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
              {loading ? "Відправка…" : "Надіслати посилання"}
            </button>
          </div>
        </form>
      )}
      <p style={{ marginTop: 24 }}>
        <Link to="/" style={{ color: "rgba(5, 180, 199, 0.95)" }}>
          На головну
        </Link>
      </p>
    </div>
  );
}
