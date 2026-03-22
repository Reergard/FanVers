import type { Book } from "../catalogApi";
import { mapTopDtoToBook } from "../top/mapTopBook";
import type { BookReaderTrendDto } from "./types";

/**
 * Тренди → **Book** для BookCard (логіка збігається з ТОПом, окремий entrypoint).
 */
export function mapTrendDtoToBook(dto: BookReaderTrendDto): Book {
  return mapTopDtoToBook(dto);
}
