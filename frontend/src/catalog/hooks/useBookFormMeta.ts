import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getGenres,
  getTags,
  getCountries,
  getFandoms,
  STALE_REF,
  type TagWithGroup,
} from "../../api/catalogApi";

export function useBookFormMeta() {
  const { data: genres = [], isLoading: genresLoading } = useQuery({
    queryKey: ["genres"],
    queryFn: getGenres,
    staleTime: STALE_REF,
    refetchOnWindowFocus: false,
  });

  const { data: tags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: getTags,
    staleTime: STALE_REF,
    refetchOnWindowFocus: false,
  });

  const { data: countries = [], isLoading: countriesLoading } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
    staleTime: STALE_REF,
    refetchOnWindowFocus: false,
  });

  const { data: fandoms = [], isLoading: fandomsLoading } = useQuery({
    queryKey: ["fandoms"],
    queryFn: getFandoms,
    staleTime: STALE_REF,
    refetchOnWindowFocus: false,
  });

  const adultTagId = tags.find((t) => t.name === "18+")?.id ?? null;

  const tagGroups = useMemo(() => {
    const byGroup = new Map<string, TagWithGroup[]>();
    for (const t of tags) {
      const key = t.group?.name ?? "Інше";
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)?.push(t);
    }
    return Array.from(byGroup.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, groupedTags]) => ({ name, tags: groupedTags }));
  }, [tags]);

  return {
    genres,
    tags,
    countries,
    fandoms,
    adultTagId,
    tagGroups,
    isLoading: genresLoading || tagsLoading || countriesLoading || fandomsLoading,
  };
}
