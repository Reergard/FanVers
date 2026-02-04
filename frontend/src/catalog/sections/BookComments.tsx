import { useState, type FormEvent } from "react";
import styles from "../styles/BookDetail.module.css";
import sendIcon from "../assets/icons/send.svg";
import deleteIcon from "../assets/icons/Delete.svg";
import leftCrystalIcon from "../assets/backgrounds/left_crystal.svg";
import rightCrystalIcon from "../assets/backgrounds/right_crystal.svg";

export type CommentItem = {
  id: string | number;
  authorName: string;
  authorAvatarUrl?: string | null;
  timeAgo: string;
  text: string;
  likes?: number;
  dislikes?: number;
  replies?: CommentItem[];
};

/** Мок-дані для перевірки верстки блоку коментарів. Потім замінити на реальні дані з API. */
export const MOCK_COMMENTS: CommentItem[] = [
  {
    id: 1,
    authorName: "Констянтин Петрович",
    timeAgo: "5 годин тому",
    text: "Чудовий переклад, дякую!",
    likes: 5,
    dislikes: 0,
    replies: [
      {
        id: 2,
        authorName: "Марія",
        timeAgo: "3 години тому",
        text: "Відповідаю на ваш коментар. Це вже не «UA Translate» a «Fan-Vers» — назву оновили.",
        likes: 2,
        dislikes: 0,
        replies: [
          {
            id: 3,
            authorName: "Олексій",
            timeAgo: "1 годину тому",
            text: "Так, проект перейменували.",
            likes: 0,
            dislikes: 0,
          },
        ],
      },
    ],
  },
  {
    id: 4,
    authorName: "Анонім",
    timeAgo: "вчора",
    text: "Коли очікувати оновлення?",
    likes: 1,
    dislikes: 1,
  },
];

type BookCommentsProps = {
  comments: CommentItem[];
  onSubmit?: (text: string) => void;
  onReply?: (commentId: string | number, text: string) => void;
  onDelete?: (commentId: string | number) => void;
  placeholder?: string;
};

function CommentCard({
  comment,
  depth,
  onReply,
  onDelete,
}: {
  comment: CommentItem;
  depth: number;
  onReply?: (commentId: string | number, text: string) => void;
  onDelete?: (commentId: string | number) => void;
}) {
  const likes = comment.likes ?? 0;
  const dislikes = comment.dislikes ?? 0;

  return (
    <li className={styles.commentItem} data-depth={depth}>
      <header>
        <div className={styles.commentAvatar}>
          {comment.authorAvatarUrl ? (
            <img src={comment.authorAvatarUrl} alt="" />
          ) : (
            <span className={styles.commentAvatarPlaceholder} aria-hidden="true" />
          )}
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
            <span className={styles.commentLike} aria-label={`Вподобань: ${likes}`}>
              ♥ {likes}
            </span>
            <span className={styles.commentDislike} aria-label={`Не вподобань: ${dislikes}`}>
              ♥ {dislikes}
            </span>
          </span>

          <button
            type="button"
            className={styles.commentReplyBtn}
            onClick={() => onReply?.(comment.id, "")}
          >
            Відповісти
          </button>
        </div>

        <div className={styles.commentFooterRight}>
          <button
            type="button"
            className={styles.commentDeleteBtn}
            onClick={() => onDelete?.(comment.id)}
          >
            <img src={deleteIcon} alt="" className={styles.commentDeleteIcon} />
            Видалити коментар
          </button>
        </div>
      </footer>
      {comment.replies && comment.replies.length > 0 && (
        <ul className={styles.commentReplies} aria-label="Відповіді">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onReply={onReply}
              onDelete={onDelete}
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
      <div className={styles.commentsHeadingWrap}>
        <h3 id="comments-heading" className={styles.commentsTitle}>
          КОМЕНТАРІ
        </h3>
        <span className={styles.commentsHeadingLine} aria-hidden="true" />
      </div>

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
          />
          <button
            type="submit"
            className={styles.commentSubmitBtn}
            aria-label="Надіслати"
          >
            <img src={sendIcon} alt="" className={styles.commentSubmitIcon} />
          </button>
        </div>
      </form>

      <ul
        className={`${styles.commentList} ${comments.length > 0 ? styles.commentListWithItems : ""}`}
        aria-label="Список коментарів"
      >
        {comments.map((comment) => (
          <CommentCard
            key={comment.id}
            comment={comment}
            depth={0}
            onReply={onReply}
            onDelete={onDelete}
          />
        ))}
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
