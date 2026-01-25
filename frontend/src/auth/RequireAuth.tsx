import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { authStatus, refreshSession } from "./service";

export function RequireAuth({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

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

  if (ok === null) return null; // Или прелоадер
  if (!ok) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
