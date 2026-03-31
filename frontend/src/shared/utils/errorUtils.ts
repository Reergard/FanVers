import { AxiosError } from "axios";

/**
 * Перевіряє, чи є помилка технічною (JavaScript/Webpack)
 */
export function isTechnicalError(message: string): boolean {
  if (typeof message !== "string") return false;

  const technicalPatterns = [
    /_WEBPACK_IMPORTED_MODULE_/,
    /\s+at\s.+/,
    /^TypeError:/,
    /^ReferenceError:/,
    /^SyntaxError:/,
    /^Error:/,
    /\.js:\d+:\d+/,
    /react-dom\.development\.js/,
    /webpack_require/,
    /__webpack_require__/,
    /invokePassiveEffectMountInDEV/,
    /commitHookEffectListMount/,
    /flushPassiveEffectsImpl/,
  ];

  return technicalPatterns.some((pattern) => pattern.test(message));
}

/**
 * Очищує технічні деталі з повідомлення про помилку
 */
export function cleanErrorMessage(message: string): string {
  if (typeof message !== "string") return String(message);

  // Видаляємо стек-трейси
  let cleaned = message.replace(/\s+at\s.+/g, "");

  // Видаляємо Webpack модулі
  cleaned = cleaned.replace(/_WEBPACK_IMPORTED_MODULE_.+$/, "");

  // Видаляємо номери строк
  cleaned = cleaned.replace(/\.js:\d+:\d+/g, "");

  // Видаляємо технічні префікси
  cleaned = cleaned.replace(/^(TypeError|ReferenceError|SyntaxError|Error):\s*/g, "");

  // Обмежуємо довжину
  const MAX_LENGTH = 200;
  if (cleaned.length > MAX_LENGTH) {
    cleaned = cleaned.slice(0, MAX_LENGTH - 1) + "…";
  }

  return cleaned.trim();
}

/**
 * Маппінг помилок від бекенда на українські повідомлення
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Авторизація
  "Invalid credentials": "Невірний логін або пароль",
  "Unable to log in with provided credentials": "Невірний логін або пароль",
  "No active account found with the given credentials": "Невірний логін або пароль",
  "Authentication credentials were not provided": "Необхідна авторизація",
  "Invalid token": "Сесія закінчилася. Будь ласка, увійдіть знову",
  "Token is invalid or expired": "Сесія закінчилася. Будь ласка, увійдіть знову",

  // Реєстрація
  "Користувач with this Логін already exists": "Користувач з таким логіном вже існує",
  "Користувач with this Email already exists": "Користувач з таким email вже існує",
  "user with this username already exists": "Користувач з таким логіном вже існує",
  "user with this email already exists": "Користувач з таким email вже існує",
  "A user with that username already exists": "Користувач з таким логіном вже існує",
  "A user with that email already exists": "Користувач з таким email вже існує",

  // Паролі
  "This password is too short": "Пароль занадто короткий",
  "This password is too common": "Пароль занадто простий",
  "This password is entirely numeric": "Пароль не може складатися тільки з цифр",
  "The password is too similar to the username": "Пароль занадто схожий на логін",
  "password is too short": "Пароль занадто короткий",
  "password is too common": "Пароль занадто простий",
  "password is entirely numeric": "Пароль не може складатися тільки з цифр",
  "password is too similar to the username": "Пароль занадто схожий на логін",
  "Паролі не співпадають": "Паролі не співпадають",
  "The two password fields didn't match": "Паролі не співпадають",
  "password fields didn't match": "Паролі не співпадають",

  // Email
  "Enter a valid email address": "Введіть коректну email адресу",
  "This field may not be blank": "Це поле обов'язкове",
  "This field is required": "Це поле обов'язкове",

  // Загальні
  "Bad Request": "Невірні дані",
  "Unauthorized": "Необхідна авторизація",
  "Forbidden": "Доступ заборонено",
  "Not Found": "Нічого не знайдено",
  "Internal Server Error": "Помилка сервера. Спробуйте пізніше",
  "Service Unavailable": "Сервіс тимчасово недоступний",
};

/**
 * Нормалізує повідомлення про помилку від бекенда
 */
function normalizeBackendMessage(message: string): string {
  // Перевіряємо маппінг
  const mapped = ERROR_MESSAGES[message];
  if (mapped) return mapped;

  // Якщо повідомлення містить ключові слова, намагаємося знайти відповідність
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  return message;
}

/**
 * Отримує користувацьке повідомлення про помилку з об'єкта помилки
 */
export function extractUserMessage(
  error: unknown,
  fallback: string = "Сталася помилка"
): string {
  // Якщо це вже строка
  if (typeof error === "string") {
    if (isTechnicalError(error)) return fallback;
    return normalizeBackendMessage(cleanErrorMessage(error));
  }

  // Якщо це AxiosError
  if (error && typeof error === "object" && "isAxiosError" in error) {
    const axiosError = error as AxiosError<any>;

    // Приоритет серверним повідомленням
    if (axiosError.response?.data) {
      const data = axiosError.response.data;

      // Обробка різних форматів помилок від Django REST Framework
      let serverMsg: string | null = null;

      // 1. Простий detail
      if (typeof data.detail === "string") {
        serverMsg = data.detail;
      }
      // 2. Масив non_field_errors
      else if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
        serverMsg = data.non_field_errors[0];
      }
      // 3. Помилки полів (username, email, password, etc.)
      else if (typeof data === "object") {
        const fieldErrors: string[] = [];
        for (const [, errors] of Object.entries(data)) {
          if (Array.isArray(errors) && errors.length > 0) {
            fieldErrors.push(String(errors[0]));
          } else if (typeof errors === "string") {
            fieldErrors.push(errors);
          }
        }
        if (fieldErrors.length > 0) {
          serverMsg = fieldErrors.join(". ");
        }
      }
      // 4. Простий рядок
      else if (typeof data === "string") {
        serverMsg = data;
      }
      // 5. Масив
      else if (Array.isArray(data) && data.length > 0) {
        serverMsg = String(data[0]);
      }

      if (serverMsg && !isTechnicalError(serverMsg)) {
        return normalizeBackendMessage(cleanErrorMessage(serverMsg));
      }
    }

    // Коди статусів
    if (axiosError.response?.status) {
      const status = axiosError.response.status;
      if (status === 400) return "Невірні дані";
      if (status === 401) return "Необхідна авторизація";
      if (status === 403) return "Доступ заборонено";
      if (status === 404) return "Нічого не знайдено";
      if (status >= 500) return "Помилка сервера. Спробуйте пізніше";
    }

    // Мережеві помилки
    if (axiosError.request && !axiosError.response) {
      return "Помилка з'єднання з сервером";
    }

    // Повідомлення з Error об'єкта
    if (axiosError.message && !isTechnicalError(axiosError.message)) {
      return normalizeBackendMessage(cleanErrorMessage(axiosError.message));
    }
  }

  // Якщо це Error об'єкт
  if (error instanceof Error) {
    if (error.message && !isTechnicalError(error.message)) {
      return normalizeBackendMessage(cleanErrorMessage(error.message));
    }
  }

  // Якщо це об'єкт
  if (error && typeof error === "object") {
    const obj = error as Record<string, any>;
    const userMsg =
      obj.detail || obj.message || obj.error || obj.msg || obj.non_field_errors?.[0];

    if (userMsg && typeof userMsg === "string" && !isTechnicalError(userMsg)) {
      return normalizeBackendMessage(cleanErrorMessage(userMsg));
    }
  }

  return fallback;
}

/**
 * Логує помилку для розробників (тільки в консоль)
 */
export function logDeveloperError(context: string, error: unknown): void {
  console.error(`[${context}] Developer Error:`, error);

  if (error instanceof Error) {
    console.error("Stack trace:", error.stack);
  }
}
