/** Query keys для React Query — закладки */

export const bookmarkKeys = {
  /** Статус закладки для книги */
  status: (bookId: number) => ["bookmark-status", bookId] as const,

  /** Список закладок користувача з фільтром за статусом */
  list: (userId: number, status: string) =>
    ["user-bookmarks", userId, status] as const,
};
