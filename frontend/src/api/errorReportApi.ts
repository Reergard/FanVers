import { http } from "./http";
import { API } from "./endpoints";

export const ERROR_REPORT_ERROR_TYPES = ["typo", "translation", "punctuation", "other"] as const;
export type ErrorReportErrorType = (typeof ERROR_REPORT_ERROR_TYPES)[number];

/** Дані форми на клієнті (тип + фрагмент + коментар). */
export type ErrorReportFormPayload = {
  book_id: number;
  chapter_id: number;
  selected_text: string;
  error_type: ErrorReportErrorType;
  comment?: string;
};

/** Узгоджено з підписами в ModalErrorReport (для відображення у сповіщеннях). */
const TYPE_UA: Record<ErrorReportErrorType, string> = {
  typo: "Опечатка",
  translation: "Переклад / формулювання",
  punctuation: "Пунктуація",
  other: "Інше",
};

function buildBackendBody(payload: ErrorReportFormPayload) {
  const lines = [`Тип помилки: ${TYPE_UA[payload.error_type]}`];
  if (payload.comment?.trim()) {
    lines.push("", "Коментар:", payload.comment.trim());
  }
  return {
    book_id: payload.book_id,
    chapter_id: payload.chapter_id,
    error_text: payload.selected_text.trim(),
    suggestion: lines.join("\n"),
  };
}

/**
 * Створює репорт помилки в тексті розділу (JWT + CSRF через спільний `http`).
 */
export async function sendErrorReport(payload: ErrorReportFormPayload): Promise<void> {
  await http.post(API.errorReports, buildBackendBody(payload));
}
