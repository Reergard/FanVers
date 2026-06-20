import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../shared/Modal/Modal";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

type AuthModalContextValue = {
  openLoginModal: (returnTo?: string) => void;
  openRegisterModal: (returnTo?: string) => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }
  return ctx;
}

/**
 * Провайдер модалок входу/реєстрації. Рендерить модалки і дає openLoginModal/openRegisterModal для відкриття з будь-якого місця.
 * Має бути всередині BrowserRouter (для useNavigate).
 */
export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const returnToRef = useRef<string>("/");

  const openLoginModal = useCallback((returnTo?: string) => {
    returnToRef.current = returnTo ?? "/";
    setLoginModalOpen(true);
  }, []);

  const openRegisterModal = useCallback((returnTo?: string) => {
    returnToRef.current = returnTo ?? "/";
    setRegisterModalOpen(true);
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setLoginModalOpen(false);
    navigate(returnToRef.current, { replace: true });
  }, [navigate]);

  const handleRegisterSuccess = useCallback(() => {
    setRegisterModalOpen(false);
    navigate(returnToRef.current, { replace: true });
  }, [navigate]);

  const switchToRegisterModal = useCallback(() => {
    setLoginModalOpen(false);
    setRegisterModalOpen(true);
  }, []);

  const value: AuthModalContextValue = {
    openLoginModal,
    openRegisterModal,
  };

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <Modal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        title="Вхід"
        className="auth-modal"
      >
        <LoginForm onSuccess={handleLoginSuccess} onSwitchToRegister={switchToRegisterModal} />
      </Modal>
      <Modal
        open={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        title="Реєстрація"
        className="auth-modal"
      >
        <RegisterForm onSuccess={handleRegisterSuccess} />
      </Modal>
    </AuthModalContext.Provider>
  );
}
