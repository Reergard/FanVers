/** Рівні доступу — контракт з backend (all | bookmarked | none) */
export type PermissionLevel = "all" | "bookmarked" | "none";

export interface BookAccessRights {
  view_permission: PermissionLevel;
  comment_book_permission: PermissionLevel;
  comment_chapter_permission: PermissionLevel;
  download_permission: PermissionLevel;
  rate_permission: PermissionLevel;
}
