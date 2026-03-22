import { useQuery } from "@tanstack/react-query";
import type { Book } from "../../api/catalogApi";
import { mapTrendDtoToBook } from "../../api/trends/mapTrendDtoToBook";
import { getTrendBooks } from "../../api/trends/trendsApi";

const STALE_MS = 1000 * 60 * 5;

/**
 * Карусель «Тренди»: GET /api/analytics_books/trends/ (окремо від ТОПу за періодом).
 */
export function useTrendBooks() {
  return useQuery({
    queryKey: ["trend-books"],
    queryFn: async (): Promise<Book[]> => {
      const rows = await getTrendBooks();
      return rows.map(mapTrendDtoToBook);
    },
    staleTime: STALE_MS,
  });
}
