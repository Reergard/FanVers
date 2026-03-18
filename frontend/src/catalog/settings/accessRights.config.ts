import type { BookAccessRights } from "./accessRights.types";

export const ACCESS_RIGHTS_FIELDS: Array<{
  key: keyof BookAccessRights;
  label: string;
}> = [
  { key: "view_permission", label: "Увійти на сторінку книги" },
  { key: "comment_book_permission", label: "Коментувати книгу" },
  { key: "comment_chapter_permission", label: "Коментувати розділ" },
  { key: "download_permission", label: "Завантажити" },
  { key: "rate_permission", label: "Оцінити" },
];

export const ACCESS_RIGHTS_LEVELS: Array<{
  value: "all" | "bookmarked" | "none";
  label: string;
}> = [
  { value: "all", label: "Усі" },
  { value: "bookmarked", label: "У кого в закладках" },
  { value: "none", label: "Ніхто" },
];
