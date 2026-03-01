import { ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { authStatus, refreshSession } from "./service";
import { useAuth } from "./useAuth";
import { useAuthModal } from "./AuthModalContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const { isAuthenticated } = useAuth();
  const { openLoginModal } = useAuthModal();
  const location = useLocation();
  const modalOpenedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        await authStatus();
        setOk(true);
      } catch {
        try {
          await refreshSession();
          await authStatus();
          setOk(true);
        } catch {
          setOk(false);
        }
      }
    })();
  }, []);

  // Коли користувач увійшов через модалку — оновлюємо ok
  useEffect(() => {
    if (isAuthenticated && ok === false) {
      setOk(true);
    }
  }, [isAuthenticated, ok]);

  // Відкриваємо модалку входу один раз коли auth не пройшов
  useEffect(() => {
    if (ok === false && !modalOpenedRef.current) {
      modalOpenedRef.current = true;
      openLoginModal(location.pathname);
    }
  }, [ok, openLoginModal, location.pathname]);

  if (ok === null) return null;
  if (!ok) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "rgba(255,255,255,0.8)" }}>
        <p>Увійдіть, щоб продовжити</p>
      </div>
    );
  }
  return <>{children}</>;
}
