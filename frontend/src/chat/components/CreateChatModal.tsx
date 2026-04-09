import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../../shared/Modal/Modal";
import { resolveAvatarUrl } from "../../shared/avatar/resolveAvatarUrl";
import ghostIcon from "../../assets/icons/Ghost.svg";
import { chatApi } from "../api/chatApi";
import type { ChatUserSearchHit } from "../api/types";
import styles from "../Chat.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (username: string, firstMessage?: string) => Promise<void> | void;
};

export function CreateChatModal({ open, onClose, onCreate }: Props) {
  const [username, setUsername] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<ChatUserSearchHit[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setUsername("");
      setFirstMessage("");
      setSubmitting(false);
      setSuggestions([]);
      setSuggestLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = username.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    let cancelled = false;
    setSuggestLoading(true);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const hits = await chatApi.searchChatUsers(q);
          if (!cancelled) setSuggestions(hits);
        } catch {
          if (!cancelled) setSuggestions([]);
        } finally {
          if (!cancelled) setSuggestLoading(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [username, open]);

  const pickUser = (hit: ChatUserSearchHit) => {
    setUsername(hit.username);
    setSuggestions([]);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim()) return;

    setSubmitting(true);
    await onCreate(username, firstMessage || undefined);
    setSubmitting(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Створити чат" className={styles.createModal}>
      <form className={styles.createForm} onSubmit={submit}>
        <label className={styles.createLabel}>
          Логін, нік з профілю або id
          <div className={styles.userSearchWrap}>
            <input
              className={styles.createInput}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Почніть вводити нік або логін…"
              autoFocus
              autoComplete="off"
            />
            {open && username.trim().length >= 2 && (suggestions.length > 0 || suggestLoading) ? (
              <ul className={styles.userSuggestList} role="listbox" aria-label="Підказки користувачів">
                {suggestLoading ? (
                  <li className={styles.systemHint} style={{ padding: "10px 12px" }}>
                    Пошук…
                  </li>
                ) : null}
                {!suggestLoading &&
                  suggestions.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        className={styles.userSuggestItem}
                        onClick={() => pickUser(hit)}
                      >
                        <img
                          className={styles.userSuggestAvatar}
                          src={resolveAvatarUrl(hit.profile_image) || ghostIcon}
                          alt=""
                        />
                        <span className={styles.userSuggestMeta}>
                          <span className={styles.userSuggestNick}>
                            {hit.profile_username || hit.username}
                          </span>
                          <span className={styles.userSuggestLogin}>@{hit.username}</span>
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        </label>

        <label className={styles.createLabel}>
          Перше повідомлення (необов'язково)
          <textarea
            className={styles.createTextarea}
            value={firstMessage}
            onChange={(event) => setFirstMessage(event.target.value)}
            placeholder="Напишіть перше повідомлення..."
            rows={3}
          />
        </label>

        <div className={styles.createActions}>
          <button type="button" className={styles.createSecondaryBtn} onClick={onClose}>
            Скасувати
          </button>
          <button type="submit" className={styles.createPrimaryBtn} disabled={submitting || !username.trim()}>
            {submitting ? "Створюємо..." : "Створити"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
