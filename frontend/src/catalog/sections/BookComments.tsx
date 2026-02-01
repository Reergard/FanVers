import { useState, type FormEvent } from "react";
import styles from "../styles/BookDetail.module.css";

export type CommentItem = {
  id: string | number;
  authorName: string;
  authorAvatarUrl?: string | null;
  timeAgo: string;
  text: string;
  likes?: number;
  replies?: CommentItem[];
};

type BookCommentsProps = {
  comments: CommentItem[];
  onSubmit?: (text: string) => void;
  onReply?: (commentId: string | number, text: string) => void;
  onDelete?: (commentId: string | number) => void;
  placeholder?: string;
};

export function BookComments({
  comments,
  onSubmit,
  onReply,
  onDelete,
  placeholder = "Прокоментуйте...",
}: BookCommentsProps) {
  const [value, setValue] = useState("");

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
      <div className={styles.headingWithLine}>
        <h3 id="comments-heading">Коментарі</h3>
        <span className={styles.headingLine} aria-hidden="true" />
      </div>

      <form className={styles.commentForm} onSubmit={handleSubmit} aria-label="Додати коментар">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label="Текст коментаря"
        />
        <button type="submit" aria-label="Надіслати">
          →
        </button>
      </form>

      <ul className={styles.commentList} aria-label="Список коментарів">
        {comments.map((comment) => (
          <li key={comment.id} className={styles.commentItem}>
            <header>
              <div className={styles.commentAvatar}>
                {comment.authorAvatarUrl ? (
                  <img src={comment.authorAvatarUrl} alt="" />
                ) : null}
              </div>
              <span className={styles.commentAuthor}>{comment.authorName}</span>
              <span className={styles.commentTime}>{comment.timeAgo}</span>
            </header>
            <p>{comment.text}</p>
            <footer>
              {comment.likes != null && comment.likes > 0 && (
                <span aria-label={`Вподобань: ${comment.likes}`}>♥ {comment.likes}</span>
              )}
              {onReply && (
                <button type="button" onClick={() => onReply(comment.id, "")}>
                  Відповісти
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className={styles.delete}
                  onClick={() => onDelete(comment.id)}
                >
                  Видалити коментар
                </button>
              )}
            </footer>
            {comment.replies && comment.replies.length > 0 && (
              <ul className={styles.commentReplies}>
                {comment.replies.map((reply) => (
                  <li key={reply.id} className={styles.commentItem}>
                    <header>
                      <div className={styles.commentAvatar}>
                        {reply.authorAvatarUrl ? (
                          <img src={reply.authorAvatarUrl} alt="" />
                        ) : null}
                      </div>
                      <span className={styles.commentAuthor}>{reply.authorName}</span>
                      <span className={styles.commentTime}>{reply.timeAgo}</span>
                    </header>
                    <p>{reply.text}</p>
                    <footer>
                      {reply.likes != null && reply.likes > 0 && (
                        <span>♥ {reply.likes}</span>
                      )}
                      {onReply && (
                        <button type="button" onClick={() => onReply(reply.id, "")}>
                          Відповісти
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          className={styles.delete}
                          onClick={() => onDelete(reply.id)}
                        >
                          Видалити коментар
                        </button>
                      )}
                    </footer>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
