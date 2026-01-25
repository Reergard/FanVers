import { setAccess } from "./token";

export const authStore = {
  csrfToken: null as string | null,
  bootstrapped: false,
};

export function setCsrf(token: string | null) {
  authStore.csrfToken = token;
}

export function markBootstrapped() {
  authStore.bootstrapped = true;
}

export function clearAuth() {
  setAccess(null);
  authStore.csrfToken = null;
  // bootstrapped не сбрасываем - он показывает что bootstrap был выполнен в этом запуске приложения
  // это не критично для очистки состояния авторизации
}
