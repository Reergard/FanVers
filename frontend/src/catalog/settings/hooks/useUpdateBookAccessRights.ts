import { useMutation, useQueryClient } from "@tanstack/react-query";
import { catalogApi, catalogKeys } from "../../../api/catalogApi";
import type { BookAccessRights } from "../accessRights.types";

export function useUpdateBookAccessRights(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BookAccessRights) =>
      catalogApi.updateBookAccessRights(slug, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.book(slug) });
    },
  });
}
