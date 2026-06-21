import { http } from "./http";
import { API } from "./endpoints";

// --- Types ---

export type CommentUser = {
  id: number;
  username: string;
  profile_image?: string | null;
};

export type ApiComment = {
  id: number;
  text: string;
  created_at: string;
  parent: number | null;
  replies: ApiComment[];
  likes_count: number;
  dislikes_count: number;
  user_reaction: "like" | "dislike" | null;
  has_owner_like: boolean;
  owner_like_type?: string | null;
  user: CommentUser;
};

// --- API functions ---

export async function fetchBookComments(bookSlug: string): Promise<ApiComment[]> {
  const res = await http.get<ApiComment[]>(API.bookComments(bookSlug));
  return Array.isArray(res.data) ? res.data : [];
}

export async function postBookComment(
  bookSlug: string,
  text: string,
  parentId?: number | null
): Promise<ApiComment> {
  const res = await http.post<ApiComment>(API.bookComments(bookSlug), {
    text,
    parent: parentId ?? null,
  });
  return res.data;
}

export async function fetchChapterComments(bookSlug: string, chapterSlug: string): Promise<ApiComment[]> {
  const res = await http.get<ApiComment[]>(API.chapterComments(bookSlug, chapterSlug));
  return Array.isArray(res.data) ? res.data : [];
}

export async function postChapterComment(
  bookSlug: string,
  chapterSlug: string,
  text: string,
  parentId?: number | null
): Promise<ApiComment> {
  const res = await http.post<ApiComment>(API.chapterComments(bookSlug, chapterSlug), {
    text,
    parent: parentId ?? null,
  });
  return res.data;
}

export async function updateReaction(
  commentId: number,
  type: "book" | "chapter",
  action: "like" | "dislike"
): Promise<unknown> {
  const res = await http.post(API.commentReaction(type, commentId), { action });
  return res.data;
}

export async function updateOwnerLike(
  commentId: number,
  type: "book" | "chapter"
): Promise<unknown> {
  const res = await http.post(API.commentOwnerLike(type, commentId), {});
  return res.data;
}

export async function deleteComment(
  type: "book" | "chapter",
  slug: string,
  commentId: number,
  bookSlug?: string
): Promise<void> {
  const url =
    type === "book"
      ? API.bookCommentDetail(slug, commentId)
      : API.chapterCommentDetail(bookSlug ?? "", slug, commentId);
  await http.delete(url);
}

export const reviewsApi = {
  fetchBookComments,
  postBookComment,
  fetchChapterComments,
  postChapterComment,
  updateReaction,
  updateOwnerLike,
  deleteComment,
};
