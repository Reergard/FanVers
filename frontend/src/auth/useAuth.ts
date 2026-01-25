import { useState, useEffect } from "react";
import { getAccess, subscribeAccessToken } from "./token";

/**
 * Реактивный хук для отслеживания состояния авторизации
 * Обновляется при изменении access токена через setAccess()
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const hasToken = getAccess() !== null;
    console.log("[useAuth] Initial state:", hasToken);
    return hasToken;
  });

  useEffect(() => {
    // Обновляем состояние при изменении токена
    const updateAuth = () => {
      const hasToken = getAccess() !== null;
      console.log("[useAuth] updateAuth вызван, новый статус:", hasToken);
      setIsAuthenticated(hasToken);
    };

    // Подписываемся на изменения
    const unsubscribe = subscribeAccessToken(updateAuth);
    console.log("[useAuth] Подписка создана");

    return unsubscribe;
  }, []);

  return isAuthenticated;
}
