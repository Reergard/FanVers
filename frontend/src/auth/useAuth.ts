import { useState, useEffect } from "react";
import { getAccess, subscribeAccessToken } from "./token";

/**
 * Реактивный хук для отслеживания состояния авторизации
 * Обновляется при изменении access токена через setAccess()
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => getAccess() !== null);

  useEffect(() => {
    const unsubscribe = subscribeAccessToken((token) => setIsAuthenticated(token !== null));
    return unsubscribe;
  }, []);

  return isAuthenticated;
}
