import { http } from "../http";
import { API } from "../endpoints";
import { normalizeBookReaderTopRow } from "./normalizeTopReaderRow";
import type { BookReaderTopDto, TopPeriod } from "./types";

export type { TopPeriod, BookReaderTopDto } from "./types";

export async function getTopBooks(period: TopPeriod): Promise<BookReaderTopDto[]> {
  const { data } = await http.get<unknown>(API.topBooks, {
    params: { type: period },
  });
  if (!Array.isArray(data)) return [];
  return data
    .map(normalizeBookReaderTopRow)
    .filter((row): row is BookReaderTopDto => row != null);
}
