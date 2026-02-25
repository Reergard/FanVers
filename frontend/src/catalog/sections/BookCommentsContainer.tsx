import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth";
import { useNotification } from "../../shared/NotificationModal/NotificationProvider";
import { reviewsApi, type ApiComment } from "../../api/reviewsApi";
import { resolveAvatarUrl } from "../../shared/avatar/resolveAvatarUrl";
import { BookComments } from "./BookComments";
import type { CommentItem } from "./BookComments";

// --- Validation ---

function validateComment(text: string): string | null {
  const t = text.trim();
  if (!t) return "Коментар не може бути порожнім";
  if (t.length < 3) return "Коментар занадто короткий (мінімум 3 символи)";
  if (t.length > 1000) return "Коментар занадто довгий (максимум 1000 символів)";
  return null;
}

// --- Spam protection ---

function useSpamProtection() {
  const [lastCommentTime, setLastCommentTime] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const canComment = useCallback(() => {
    const now = Date.now();
    const timeSinceLastComment = now - lastCommentTime;
    const minInterval = 5000;

    if (timeSinceLastComment < minInterval) {
      setIsBlocked(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setIsBlocked(false);
      }, minInterval - timeSinceLastComment);
      return false;
    }
    return true;
  }, [lastCommentTime]);

  const recordComment = useCallback(() => {
    setLastCommentTime(Date.now());
  }, []);

  return { canComment, recordComment, isBlocked };
}

// --- Format helpers ---

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

  if (diffInHours < 1) return "менше години тому";
  if (diffInHours === 1) return "1 годину тому";
  if (diffInHours < 24) return `${diffInHours} годин тому`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return "1 день тому";
  if (diffInDays < 7) return `${diffInDays} днів тому`;

  return date.toLocaleDateString("uk-UA");
}

// --- Map API comment to UI ---

function mapApiCommentToItem(c: ApiComment, userId: number | null, isOwner: boolean): CommentItem {
  return {
    id: c.id,
    authorName: c.user?.username ?? "Невідомий користувач",
    authorAvatarUrl: resolveAvatarUrl(c.user?.profile_image),
    timeAgo: formatTimeAgo(c.created_at),
    text: c.text,
    likes: c.likes_count ?? 0,
    dislikes: c.dislikes_count ?? 0,
    replies: (c.replies ?? []).map((r) => mapApiCommentToItem(r, userId, isOwner)),
    userReaction: c.user_reaction ?? null,
    hasOwnerLike: c.has_owner_like ?? false,
    ownerLikeType: c.owner_like_type ?? "Автора",
    showOwnerLikeButton: isOwner && !(c.has_owner_like ?? false),
    canDelete: userId != null && c.user?.id === userId,
  };
}

// --- Container ---

export type BookCommentsContainerProps = {
  type: "book" | "chapter";
  slug: string;
  isOwner: boolean;
};

export function BookCommentsContainer({ type, slug, isOwner }: BookCommentsContainerProps) {
  const { isAuthenticated, userId } = useAuth();
  const { showError } = useNotification();
  const qc = useQueryClient();
  const { canComment, recordComment, isBlocked } = useSpamProtection();

  const [commentText, setCommentText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryKey = type === "book" ? ["book-comments", slug] : ["chapter-comments", slug];

  const fetchComments = type === "book"
    ? () => reviewsApi.fetchBookComments(slug)
    : () => reviewsApi.fetchChapterComments(slug);

  const postComment = type === "book"
    ? (text: string, parentId?: number | null) => reviewsApi.postBookComment(slug, text, parentId)
    : (text: string, parentId?: number | null) => reviewsApi.postChapterComment(slug, text, parentId);

  const { data: comments = [], isError } = useQuery({
    queryKey,
    queryFn: fetchComments,
    enabled: !!slug,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const hasShownFetchError = useRef(false);
  useEffect(() => {
    if (isError && !hasShownFetchError.current) {
      hasShownFetchError.current = true;
      showError("Помилка при завантаженні коментарів. Спробуйте пізніше.");
    }
    if (!isError) hasShownFetchError.current = false;
  }, [isError, showError]);

  const reactionMutation = useMutation({
    mutationFn: ({ commentId, action }: { commentId: number; action: "like" | "dislike" }) =>
      reviewsApi.updateReaction(commentId, type, action),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const ownerLikeMutation = useMutation({
    mutationFn: (commentId: number) => reviewsApi.updateOwnerLike(commentId, type),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => reviewsApi.deleteComment(type, slug, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  // Не показуємо "порожній" — тільки при введенні невалідного тексту
  const validationError =
    commentText.trim().length > 0 ? (validateComment(commentText) ?? "") : "";

  const handleDelete = async (commentId: string | number) => {
    if (!isAuthenticated) return;
    const id = Number(commentId);
    if (Number.isNaN(id)) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Невідома помилка";
      const status = (e as { response?: { status?: number } })?.response?.status;
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (status === 403) {
        showError(detail ?? "У вас немає прав для видалення цього коментаря");
      } else {
        showError("Помилка при видаленні коментаря: " + msg);
      }
    }
  };

  const handleSubmit = async (text: string) => {
    if (!isAuthenticated || !text.trim()) return;

    const err = validateComment(text);
    if (err) {
      showError(err);
      return;
    }
    if (!canComment()) {
      showError("Занадто швидко! Зачекайте 5 секунд перед наступним коментарем");
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await postComment(text);
      setCommentText("");
      recordComment();
      qc.invalidateQueries({ queryKey });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Невідома помилка";
      const status = (e as { response?: { status?: number; data?: { detail?: string } } })?.response?.status;
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;

      if (status === 403) {
        showError(detail ?? (type === "book" ? "У вас немає прав для коментування цієї книги" : "У вас немає прав для коментування цього розділу"));
      } else {
        showError("Помилка при відправці коментаря: " + msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplySubmit = async (parentId: number, text: string) => {
    if (!isAuthenticated || !text.trim()) return;

    const err = validateComment(text);
    if (err) {
      showError(err);
      return;
    }
    if (!canComment()) {
      showError("Занадто швидко! Зачекайте 5 секунд перед наступним коментарем");
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await postComment(text, parentId);
      setReplyText("");
      setReplyingToId(null);
      recordComment();
      qc.invalidateQueries({ queryKey });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Невідома помилка";
      const status = (e as { response?: { status?: number } })?.response?.status;
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;

      if (status === 403) {
        showError(detail ?? (type === "book" ? "У вас немає прав для коментування цієї книги" : "У вас немає прав для коментування цього розділу"));
      } else {
        showError("Помилка при відправці відповіді: " + msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReaction = (commentId: number, action: "like" | "dislike") => {
    if (!isAuthenticated) return;
    reactionMutation.mutate({ commentId, action });
  };

  const handleOwnerLike = (commentId: number) => {
    if (!isAuthenticated || !isOwner) return;
    ownerLikeMutation.mutate(commentId);
  };

  const mappedComments: CommentItem[] = comments.map((c) =>
    mapApiCommentToItem(c, userId, isOwner)
  );

  const emptyMessage =
    type === "book"
      ? "Коментарів поки ще немає."
      : "Коментарів до розділу поки ще немає.";

  return (
    <BookComments
      comments={mappedComments}
      onSubmit={handleSubmit}
      onReply={handleReplySubmit}
      onReaction={handleReaction}
      onOwnerLike={handleOwnerLike}
      onDelete={handleDelete}
      isAuthenticated={isAuthenticated}
      disabled={isSubmitting || isBlocked}
      validationError={validationError || undefined}
      isBlocked={isBlocked}
      emptyMessage={emptyMessage}
      placeholder={type === "book" ? "Прокоментуйте..." : "Прокоментуйте розділ..."}
      commentValue={commentText}
      onCommentChange={setCommentText}
      replyingToId={replyingToId}
      replyText={replyText}
      onReplyTextChange={setReplyText}
      onReplyCancel={() => {
        setReplyingToId(null);
        setReplyText("");
      }}
      onReplyOpen={(id) => setReplyingToId(id)}
      isDeletingId={deleteMutation.isPending ? (deleteMutation.variables as number) : null}
    />
  );
}
