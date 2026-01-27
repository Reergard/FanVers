/**
 * Самотест авторизации (только в dev).
 * Цепочка: GET csrf → POST login → POST refresh (200) → очистить access → protected запрос (401→refresh→retry) → POST logout → POST refresh (401).
 * Запуск: в dev при VITE_AUTH_SELFTEST=true вызывается автоматически из bootstrap или вручную authSelfTest().
 * Требует в .env: VITE_AUTH_TEST_USER, VITE_AUTH_TEST_PASSWORD.
 */
import { fetchCsrfToken } from "./csrf";
import { loginSession, refreshSession, logoutSession, authStatus } from "./service";
import { setAccess } from "./token";

const DEV = import.meta.env.DEV;
const TEST_USER = import.meta.env.VITE_AUTH_TEST_USER as string | undefined;
const TEST_PASSWORD = import.meta.env.VITE_AUTH_TEST_PASSWORD as string | undefined;

export async function authSelfTest(): Promise<{ ok: boolean; steps: string[] }> {
  const steps: string[] = [];
  if (!DEV) {
    steps.push("SKIP: not dev");
    return { ok: true, steps };
  }
  if (!TEST_USER || !TEST_PASSWORD) {
    steps.push("SKIP: set VITE_AUTH_TEST_USER and VITE_AUTH_TEST_PASSWORD in .env to run self-test");
    console.log("[authSelfTest]", steps[0]);
    return { ok: true, steps };
  }

  try {
    // 1) GET /csrf/
    await fetchCsrfToken();
    steps.push("GET /csrf/ ok");

    // 2) POST /login/
    await loginSession({ username: TEST_USER, password: TEST_PASSWORD });
    steps.push("POST /login/ ok");

    // 3) POST /refresh/ (должен быть 200)
    await refreshSession();
    steps.push("POST /refresh/ 200 ok");

    // 4) Очистить access → protected запрос → должен пройти через 401→refresh→retry
    setAccess(null);
    await authStatus();
    steps.push("cleared access → authStatus() via 401→refresh→retry ok");

    // 5) POST /logout/
    await logoutSession();
    steps.push("POST /logout/ ok");

    // 6) POST /refresh/ → должен быть 401
    try {
      await refreshSession();
      steps.push("POST /refresh/ after logout: FAIL (expected 401)");
      return { ok: false, steps };
    } catch (e: any) {
      if (e?.response?.status === 401) {
        steps.push("POST /refresh/ 401 ok (expected)");
      } else {
        return { ok: false, steps: [...steps, `unexpected ${e?.response?.status ?? e?.message}`] };
      }
    }

    console.log("[authSelfTest] all steps ok", steps);
    return { ok: true, steps };
  } catch (err: any) {
    steps.push(`FAIL: ${err?.message ?? String(err)}`);
    console.error("[authSelfTest]", steps);
    return { ok: false, steps };
  }
}
