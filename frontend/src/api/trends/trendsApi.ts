import { http } from "../http";
import { API } from "../endpoints";
import { normalizeTrendReaderRow } from "./normalizeTrendReaderRow";
import type { BookReaderTrendDto } from "./types";

export async function getTrendBooks(): Promise<BookReaderTrendDto[]> {
  const { data } = await http.get<unknown>(API.trendBooks);
  if (!Array.isArray(data)) return [];
  return data
    .map(normalizeTrendReaderRow)
    .filter((row): row is BookReaderTrendDto => row != null);
}
