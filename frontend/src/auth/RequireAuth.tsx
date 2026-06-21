import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { useAuthModal } from "./AuthModalContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();
  const { openLoginModal } = useAuthModal();
  const location = useLocation();
  const modalOpenedRef = useRef(false);

  // Відкриваємо модалку входу один раз коли bootstrap завершився і користувач не автентифікований
  useEffect(() => {
    if (authReady && !isAuthenticated && !modalOpenedRef.current) {
      modalOpenedRef.current = true;
      openLoginModal(location.pathname);
    }
  }, [authReady, isAuthenticated, openLoginModal, location.pathname]);

  // Скидаємо прапорець, якщо користувач увійшов — щоб при наступному виході модалка відкрилась знову
  useEffect(() => {
    if (isAuthenticated) {
      modalOpenedRef.current = false;
    }
  }, [isAuthenticated]);

  // Bootstrap ще не завершився — показуємо індикатор завантаження
  if (!authReady) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
        <p>Завантаження…</p>
      </div>
    );
  }

  // Користувач не автентифікований — повідомлення + модалка вже відкрита вище
  if (!isAuthenticated) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "rgba(255,255,255,0.8)" }}>
        <p>Увійдіть, щоб продовжити</p>
      </div>
    );
  }

  return <>{children}</>;
}
