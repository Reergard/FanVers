import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getPaymentSessionStatus } from "./paymentApi";
import { refreshAuthStatus } from "../auth/service";

type Status = "pending" | "paid" | "expired" | "failed";

function useQueryParam(name: string): string | null {
  const { search } = useLocation();
  return useMemo(() => {
    const sp = new URLSearchParams(search);
    const v = sp.get(name);
    return v && v.trim() ? v : null;
  }, [search, name]);
}

export function PaymentSuccess() {
  const navigate = useNavigate();
  const sessionId = useQueryParam("session_id");

  const [status, setStatus] = useState<Status>("pending");
  const [amount, setAmount] = useState<string | null>(null);
  const [paidAt, setPaidAt] = useState<string | null>(null);
  const [info, setInfo] = useState<string>("Перевіряємо оплату…");

  const startedAtRef = useRef<number>(Date.now());
  const stoppedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!sessionId) {
      setStatus("failed");
      setInfo("Немає session_id у посиланні.");
      return;
    }

    stoppedRef.current = false;
    startedAtRef.current = Date.now();

    const tick = async () => {
      try {
        const res = await getPaymentSessionStatus(sessionId);
        setStatus(res.status);
        setAmount(res.amount_coins);
        setPaidAt(res.paid_at);

        if (res.status === "paid") {
          setInfo("Оплата пройшла успішно. Баланс оновлюємо…");
          await refreshAuthStatus();
          setInfo("Оплата підтверджена. FanCoins зараховано.");
          stoppedRef.current = true;
          return;
        }

        if (res.status === "expired" || res.status === "failed") {
          setInfo("Оплата не завершена або сесія протухла.");
          stoppedRef.current = true;
          return;
        }

        const elapsed = Date.now() - startedAtRef.current;
        if (elapsed > 60_000) {
          setInfo("Оплата обробляється. Баланс буде оновлено найближчим часом.");
          stoppedRef.current = true;
        }
      } catch {
        setInfo("Не вдалося перевірити статус платежу. Спробуйте оновити сторінку.");
        stoppedRef.current = true;
      }
    };

    void tick();
    const id = window.setInterval(() => {
      if (stoppedRef.current) return;
      void tick();
    }, 2000);

    return () => {
      window.clearInterval(id);
      stoppedRef.current = true;
    };
  }, [sessionId]);

  return (
    <section style={{ minHeight: "60dvh", padding: "48px 16px", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 720 }}>
        <h2 style={{ color: "rgba(255,255,255,0.92)", marginBottom: 12 }}>Оплата</h2>
        <p style={{ color: "rgba(255,255,255,0.78)", marginBottom: 18 }}>{info}</p>

        {amount ? (
          <div style={{ color: "rgba(255,255,255,0.78)", marginBottom: 18 }}>
            <div>Сума: {amount} FanCoins</div>
            {paidAt ? <div>Час: {paidAt}</div> : null}
            <div>Статус: {status}</div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate("/profile")}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "rgba(0, 255, 168, 0.14)",
              border: "1px solid rgba(0, 255, 168, 0.35)",
              color: "rgba(255,255,255,0.92)",
              cursor: "pointer",
            }}
          >
            Повернутися до профілю
          </button>

          {(status === "expired" || status === "failed") && (
            <button
              type="button"
              onClick={() => navigate("/profile")}
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                background: "rgba(255, 70, 70, 0.12)",
                border: "1px solid rgba(255, 70, 70, 0.35)",
                color: "rgba(255,255,255,0.92)",
                cursor: "pointer",
              }}
            >
              Спробувати ще раз
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

