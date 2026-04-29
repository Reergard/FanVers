import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { httpRaw } from "../api/httpRaw";
import { API } from "../api/endpoints";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { resendActivation } from "./activationApi";

type State = "loading" | "success" | "error";

/**
 * Сторінка активації акаунта. Користувач потрапляє сюди з листа (посилання виду
 * https://fan-vers.com/activate/<uid>/<token>). При монтуванні робимо POST на
 * djoser-endpoint /api/auth/users/activation/ — на успіх redirect на головну.
 */
export function ActivateAccountPage() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const navigate = useNavigate();
  const notification = useNotification();
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const didRunRef = useRef(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setTimeout(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    if (!uid || !token) {
      setState("error");
      setErrorMsg("Невірне посилання активації.");
      return;
    }

    (async () => {
      try {
        await httpRaw.post(API.activateAccount, { uid, token });
        setState("success");
        setTimeout(() => navigate("/", { replace: true }), 2500);
      } catch (e: unknown) {
        const err = e as {
          response?: { data?: Record<string, unknown>; status?: number };
        };
        const data = err?.response?.data;
        let msg = "Посилання недійсне або вже використане.";
        if (data) {
          if (typeof data.detail === "string") msg = data.detail;
          else if (Array.isArray((data as { token?: string[] }).token))
            msg = (data as { token: string[] }).token[0];
          else if (Array.isArray((data as { uid?: string[] }).uid))
            msg = (data as { uid: string[] }).uid[0];
          else if (
            Array.isArray((data as { non_field_errors?: string[] }).non_field_errors)
          )
            msg = (data as { non_field_errors: string[] }).non_field_errors[0];
        }
        setState("error");
        setErrorMsg(msg);
      }
    })();
  }, [uid, token, navigate]);

  const handleResend = async () => {
    const email = resendEmail.trim();
    if (!email) {
      notification.showError("Введіть email для повторної відправки.");
      return;
    }
    setResendLoading(true);
    try {
      await resendActivation(email);
      notification.showSuccess(
        "Якщо такий email існує і ще не активований — лист надіслано повторно."
      );
      setResendCooldown(60);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } };
      if (err?.response?.status === 429) {
        notification.showError("Занадто багато запитів. Спробуйте пізніше.");
      } else {
        notification.showError("Не вдалося надіслати лист. Спробуйте пізніше.");
      }
    } finally {
      setResendLoading(false);
    }
  };

  const baseStyle: React.CSSProperties = {
    padding: "48px 24px",
    textAlign: "center",
    color: "rgba(255,255,255,0.9)",
    minHeight: "60vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    maxWidth: 420,
    margin: "0 auto",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 320,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid rgba(5, 180, 199, 0.35)",
    background: "rgba(0,0,0,0.25)",
    color: "#fff",
    fontSize: 15,
  };

  if (state === "loading") {
    return (
      <div style={baseStyle}>
        <p>Підтверджуємо ваш email... Зачекайте.</p>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div style={baseStyle}>
        <h2 style={{ margin: 0 }}>Email підтверджено ✅</h2>
        <p>Реєстрація завершена. Зараз перенаправимо на головну сторінку.</p>
      </div>
    );
  }

  return (
    <div style={baseStyle}>
      <h2 style={{ margin: 0 }}>Не вдалося активувати акаунт</h2>
      <p>{errorMsg}</p>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        <input
          type="email"
          name="resend-email"
          placeholder="Email для повторного листа"
          value={resendEmail}
          onChange={(e) => setResendEmail(e.target.value)}
          autoComplete="email"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={handleResend}
          disabled={resendLoading || resendCooldown > 0}
          style={{
            padding: "8px 16px",
            border: "1px solid rgba(255,255,255,0.4)",
            background: "transparent",
            color: "inherit",
            borderRadius: 6,
            cursor: resendLoading || resendCooldown > 0 ? "not-allowed" : "pointer",
            opacity: resendLoading || resendCooldown > 0 ? 0.7 : 1,
          }}
        >
          {resendLoading
            ? "Відправка..."
            : resendCooldown > 0
              ? `Повторна відправка через ${resendCooldown}с`
              : "Надіслати лист повторно"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => navigate("/", { replace: true })}
        style={{
          marginTop: 8,
          padding: "10px 20px",
          border: "1px solid rgba(255,255,255,0.4)",
          background: "transparent",
          color: "inherit",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        На головну
      </button>
    </div>
  );
}
