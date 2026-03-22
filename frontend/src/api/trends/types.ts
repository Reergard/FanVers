/**
 * DTO каруселі «Тренди» (GET /api/analytics_books/trends/).
 * Формат той самий, що у BookReaderSerializer / ТОПу — окремий тип для читабельності імпортів.
 */
export type { BookReaderTopDto as BookReaderTrendDto } from "../top/types";
