import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { httpRaw } from "../api/httpRaw";
import { API } from "../api/endpoints";
import { setAccess } from "./token";
import { setAuthAuthenticated } from "./store";
import { authStatus } from "./service";

/**
 * Сторінка OAuth callback. Backend редіректить сюди з ?code=XXX після успішного Google/Facebook login.
 * Обмінюємо code на access token, зберігаємо, редіректимо на головну.
 */
export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const oauthError = searchParams.get("oauth");
    const message = searchParams.get("message");

    if (oauthError === "error" || message) {
      setError(message || "OAuth помилка");
      setTimeout(() => navigate("/", { replace: true }), 3000);
      return;
    }

    if (!code) {
      setError("Відсутній code");
      setTimeout(() => navigate("/", { replace: true }), 3000);
      return;
    }

    (async () => {
      try {
        const { data } = await httpRaw.post(
          API.oauthExchange,
          { code },
          { withCredentials: true }
        );
        if (data?.access) {
          setAccess(data.access);
          const userData = await authStatus();
          setAuthAuthenticated({
            userId: userData?.userId ?? null,
            username: userData?.username ?? null,
            balance: userData?.balance ?? null,
            canWithdrawBalance: Boolean(userData?.can_withdraw_balance),
            roleSelfPromotionAllowed: Boolean(userData?.role_self_promotion_allowed),
          });
          navigate("/", { replace: true });
        } else {
          setError("Не вдалося отримати токен");
          setTimeout(() => navigate("/", { replace: true }), 3000);
        }
      } catch (e: unknown) {
        const err = e as { response?: { status?: number } };
        setError(err?.response?.status === 401 ? "Термін дії code вийшов" : "Помилка обміну code");
        setTimeout(() => navigate("/", { replace: true }), 3000);
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div style={{ padding: "48px 24px", textAlign: "center", color: "rgba(255,255,255,0.9)" }}>
      {error ? (
        <p>Помилка: {error}. Перенаправлення на головну...</p>
      ) : (
        <p>Вхід через соцмережу... Зачекайте.</p>
      )}
    </div>
  );
}
