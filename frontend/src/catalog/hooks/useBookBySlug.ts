import { useQuery } from "@tanstack/react-query";
import { catalogApi, catalogKeys, STALE_REF } from "../../api/catalogApi";

export function useBookBySlug(slug: string) {
  return useQuery({
    queryKey: catalogKeys.book(slug),
    queryFn: () => catalogApi.getBook(slug),
    enabled: Boolean(slug),
    staleTime: STALE_REF,
    refetchOnWindowFocus: false,
  });
}
