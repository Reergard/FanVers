let accessToken: string | null = null;

export function setAccess(token: string | null) {
  accessToken = token;
}

export function getAccess() {
  return accessToken;
}

// Опционально: проверить exp без запросов (JWT payload)
export function getJwtExpMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload?.exp) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}
