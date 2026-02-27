import { useMutation } from "@tanstack/react-query";
import { catalogApi, type UpdateBookPayload } from "../../api/catalogApi";

export function useBookUpdate(slug: string) {
  return useMutation({
    mutationFn: (payload: UpdateBookPayload) => catalogApi.updateBook(slug, payload),
  });
}
