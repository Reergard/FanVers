import { useState, useEffect, useCallback } from "react";
import { getAccess, subscribeAccessToken } from "./token";
import { authStatus } from "./service";

export type AuthState = {
  isAuthenticated: boolean;
  userId: number | null;
  username: string | null;
  balance: string | null;
};

/**
 * Реактивный хук для отслеживания состояния авторизации, ника и баланса пользователя
 */
export function useAuth(): AuthState {
  const [isAuthenticated, setIsAuthenticated] = useState(() => getAccess() !== null);
  const [userId, setUserId] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    try {
      const data = await authStatus();
      setUserId(data?.userId ?? null);
      setUsername(data?.username ?? null);
      setBalance(data?.balance ?? null);
    } catch {
      setUserId(null);
      setUsername(null);
      setBalance(null);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAccessToken((token) => {
      const auth = token !== null;
      setIsAuthenticated(auth);
      if (!auth) {
        setUserId(null);
        setUsername(null);
        setBalance(null);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isAuthenticated && username === null) {
      fetchUserData();
    }
  }, [isAuthenticated, username, fetchUserData]);

  return { isAuthenticated, userId, username, balance };
}
