import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Book } from "../../api/catalogApi";
import { getTopBooks, type TopPeriod } from "../../api/top/topApi";
import { mapTopDtoToBook } from "../../api/top/mapTopBook";

const STALE_MS = 1000 * 60 * 5;

export type { TopPeriod };

/**
 * ТОП книг за періодом: GET /api/analytics_books/top/?type=...
 * Повертає адаптовані Book[] для BookCard.
 */
export function useTopBooks(period: TopPeriod) {
  return useQuery({
    queryKey: ["top-books", period],
    queryFn: async (): Promise<Book[]> => {
      const rows = await getTopBooks(period);
      return rows.map(mapTopDtoToBook);
    },
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
}
