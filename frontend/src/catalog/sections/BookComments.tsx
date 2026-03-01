import { useState, type FormEvent } from "react";
import styles from "../styles/BookDetail.module.css";
import sendIcon from "../assets/icons/send.svg";
import deleteIcon from "../assets/icons/Delete.svg";
import leftCrystalIcon from "../assets/backgrounds/left_crystal.svg";
import rightCrystalIcon from "../assets/backgrounds/right_crystal.svg";
import { resolveAvatarUrl } from "../../shared/avatar/resolveAvatarUrl";

export type CommentItem = {
  id: string | number;
  authorName: string;
  authorAvatarUrl?: string | null;
  timeAgo: string;
  text: string;
  likes?: number;
  dislikes?: number;
  replies?: CommentItem[];
  userReaction?: "like" | "dislike" | null;
  hasOwnerLike?: boolean;
  ownerLikeType?: string | null;
  showOwnerLikeButton?: boolean;
  canDelete?: boolean;
};

type BookCommentsProps = {
  comments: CommentItem[];
  onSubmit?: (text: string) => void;
  onReply?: (commentId: number, text: string) => void;
  onReaction?: (commentId: number, action: "like" | "dislike") => void;
  onOwnerLike?: (commentId: number) => void;
  onDelete?: (commentId: string | number) => void;
  placeholder?: string;
  isAuthenticated?: boolean;
  disabled?: boolean;
  validationError?: string;
  isBlocked?: boolean;
  emptyMessage?: string;
  replyingToId?: number | null;
  replyText?: string;
  onReplyTextChange?: (value: string) => void;
  onReplyCancel?: () => void;
  onReplyOpen?: (commentId: number) => void;
  /** Controlled main form: value + onChange. Если не передано — используется внутренний state. */
  commentValue?: string;
  onCommentChange?: (value: string) => void;
  /** ID коментаря, що зараз видаляється (для disabled стану кнопки). */
  isDeletingId?: number | null;
};

function CommentCard({
  comment,
  depth,
  onReply,
  onReaction,
  onOwnerLike,
  onDelete,
  onReplyOpen,
  replyingToId,
  replyText,
  onReplyTextChange,
  onReplyCancel,
  isAuthenticated,
  isDeletingId,
}: {
  comment: CommentItem;
  depth: number;
  onReply?: (commentId: number, text: string) => void;
  onReaction?: (commentId: number, action: "like" | "dislike") => void;
  onOwnerLike?: (commentId: number) => void;
  onDelete?: (commentId: string | number) => void;
  isDeletingId?: number | null;
  onReplyOpen?: (commentId: number) => void;
  replyingToId?: number | null;
  replyText?: string;
  onReplyTextChange?: (value: string) => void;
  onReplyCancel?: () => void;
  isAuthenticated?: boolean;
}) {
  const likes = comment.likes ?? 0;
  const dislikes = comment.dislikes ?? 0;
  const commentId = Number(comment.id);
  const isReplying = replyingToId === commentId;

  return (
    <li className={styles.commentItem} data-depth={depth}>
      <header>
        <div className={styles.commentAvatar}>
          <img src={resolveAvatarUrl(comment.authorAvatarUrl)} alt="" />
        </div>
        <span className={styles.commentAuthor}>{comment.authorName}</span>
        <span className={styles.commentTime}>{comment.timeAgo}</span>
      </header>
      <p className={styles.commentText}>{comment.text}</p>
      <footer className={styles.commentFooter}>
        <div className={styles.commentFooterLeft}>
          <span
            className={styles.commentReactions}
            aria-label={`Вподобань: ${likes}, не вподобань: ${dislikes}`}
          >
            {isAuthenticated && onReaction ? (
              <>
                <button
                  type="button"
                  className={styles.commentReactionBtn}
                  onClick={() => onReaction(commentId, "like")}
                  aria-label={comment.userReaction === "like" ? "Прибрати вподобання" : "Вподобати"}
                >
                  <span className={comment.userReaction === "like" ? styles.commentLike : styles.commentLikeMuted}>
                    ♥ {likes}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.commentReactionBtn}
                  onClick={() => onReaction(commentId, "dislike")}
                  aria-label={comment.userReaction === "dislike" ? "Прибрати невподобання" : "Невподобати"}
                >
                  <span className={comment.userReaction === "dislike" ? styles.commentDislike : styles.commentDislikeMuted}>
                    ♥ {dislikes}
                  </span>
                </button>
              </>
            ) : (
              <>
                <span className={styles.commentLike} aria-label={`Вподобань: ${likes}`}>
                  ♥ {likes}
                </span>
                <span className={styles.commentDislike} aria-label={`Не вподобань: ${dislikes}`}>
                  ♥ {dislikes}
                </span>
              </>
            )}
          </span>

          {isAuthenticated && (
            <button
              type="button"
              className={styles.commentReplyBtn}
              onClick={() => onReplyOpen?.(commentId)}
            >
              Відповісти
            </button>
          )}
        </div>

        <div className={styles.commentFooterRight}>
          {comment.hasOwnerLike && (
            <span className={styles.ownerLikeDisplay}>
              ✅ {comment.ownerLikeType ?? "Автора"}
            </span>
          )}
          {comment.showOwnerLikeButton && onOwnerLike && (
            <button
              type="button"
              className={styles.commentOwnerLikeBtn}
              onClick={() => onOwnerLike(commentId)}
            >
              ⭐ {comment.ownerLikeType ?? "Автора"}
            </button>
          )}
          {comment.canDelete && onDelete && (
            <button
              type="button"
              className={styles.commentDeleteBtn}
              onClick={() => onDelete(comment.id)}
              disabled={isDeletingId === comment.id}
              aria-label={`Видалити коментар від ${comment.authorName}`}
            >
              <img src={deleteIcon} alt="" className={styles.commentDeleteIcon} aria-hidden="true" />
              {isDeletingId === comment.id ? "Видалення…" : "Видалити коментар"}
            </button>
          )}
        </div>
      </footer>

      {isReplying && onReplyTextChange !== undefined && onReplyCancel && (
        <div className={styles.replyForm}>
          <input
            type="text"
            value={replyText ?? ""}
            onChange={(e) => onReplyTextChange(e.target.value)}
            placeholder="Відповісти на коментар..."
            className={styles.commentInput}
            maxLength={1000}
          />
          <button
            type="button"
            className={styles.commentSubmitBtn}
            onClick={() => {
              const t = (replyText ?? "").trim();
              if (t && onReply) onReply(commentId, t);
            }}
            disabled={!(replyText ?? "").trim()}
          >
            <img src={sendIcon} alt="" className={styles.commentSubmitIcon} />
          </button>
          <button type="button" className={styles.commentReplyBtn} onClick={onReplyCancel}>
            Скасувати
          </button>
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <ul className={styles.commentReplies} aria-label="Відповіді">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onReply={onReply}
              onReaction={onReaction}
              onOwnerLike={onOwnerLike}
              onDelete={onDelete}
              onReplyOpen={onReplyOpen}
              isDeletingId={isDeletingId}
              replyingToId={replyingToId}
              replyText={replyText}
              onReplyTextChange={onReplyTextChange}
              onReplyCancel={onReplyCancel}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function BookComments({
  comments,
  onSubmit,
  onReply,
  onReaction,
  onOwnerLike,
  onDelete,
  placeholder = "Прокоментуйте...",
  isAuthenticated = false,
  disabled = false,
  validationError,
  isBlocked,
  emptyMessage = "Коментарів поки ще немає.",
  replyingToId = null,
  replyText = "",
  onReplyTextChange,
  onReplyCancel,
  onReplyOpen,
  commentValue,
  onCommentChange,
  isDeletingId,
}: BookCommentsProps) {
  const [internalValue, setInternalValue] = useState("");
  const value = commentValue !== undefined ? commentValue : internalValue;
  const setValue = onCommentChange ?? setInternalValue;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed && onSubmit) {
      onSubmit(trimmed);
      setValue("");
    }
  }

  return (
    <section className={styles.comments} aria-labelledby="comments-heading">
      <div className={styles.commentsHeadingWrap}>
        <h3 id="comments-heading" className={styles.commentsTitle}>
          КОМЕНТАРІ:
        </h3>
        <span className={styles.commentsHeadingLine} aria-hidden="true" />
      </div>

      {isAuthenticated ? (
        <form
          className={styles.commentForm}
          onSubmit={handleSubmit}
          aria-label="Додати коментар"
        >
          <div className={styles.commentInputWrap}>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              aria-label="Текст коментаря"
              className={styles.commentInput}
              disabled={disabled}
              maxLength={1000}
            />
            <button
              type="submit"
              className={styles.commentSubmitBtn}
              aria-label="Надіслати"
              disabled={disabled || !value.trim() || !!validationError}
            >
              <img src={sendIcon} alt="" className={styles.commentSubmitIcon} />
            </button>
          </div>
          {validationError && (
            <p className={styles.commentValidationError} role="alert">
              {validationError}
            </p>
          )}
          {isBlocked && (
            <p className={styles.commentBlockedHint}>
              Занадто швидко! Зачекайте перед наступним коментарем.
            </p>
          )}
        </form>
      ) : (
        <p className={styles.commentLoginHint}>Увійдіть, щоб залишити коментар</p>
      )}

      <ul
        className={`${styles.commentList} ${comments.length > 0 ? styles.commentListWithItems : ""}`}
        aria-label="Список коментарів"
      >
        {comments.length > 0 ? (
          comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              depth={0}
              onReply={onReply}
              onReaction={onReaction}
              onOwnerLike={onOwnerLike}
              onDelete={onDelete}
              onReplyOpen={onReplyOpen}
              isDeletingId={isDeletingId}
              replyingToId={replyingToId}
              replyText={replyText}
              onReplyTextChange={onReplyTextChange}
              onReplyCancel={onReplyCancel}
              isAuthenticated={isAuthenticated}
            />
          ))
        ) : (
          <li className={styles.commentEmpty}>{emptyMessage}</li>
        )}
      </ul>

      <img
        src={leftCrystalIcon}
        alt=""
        className={styles.commentsCrystalLeft}
        aria-hidden="true"
      />
      <img
        src={rightCrystalIcon}
        alt=""
        className={styles.commentsCrystalRight}
        aria-hidden="true"
      />
    </section>
  );
}
