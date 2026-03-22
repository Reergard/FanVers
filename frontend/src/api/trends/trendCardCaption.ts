import type { Book } from "../catalogApi";
import { getTopCardCaptionFromBook } from "../top/mapTopBook";

/**
 * Підпис під карткою в каруселі «Тренди» (зараз той самий текст, що й у ТОПі).
 */
export function getTrendCardCaptionFromBook(book: Book): string {
  return getTopCardCaptionFromBook(book);
}
