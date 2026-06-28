import { useEffect, useMemo, useState } from "react";
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

function clsx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function isLongFirstMessage(text: string): boolean {
  if (text.length >= 100) return true;
  return text.split(/\r?\n/).length >= 3;
}

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

  const expanded = useMemo(() => isLongFirstMessage(firstMessage), [firstMessage]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim()) return;

    setSubmitting(true);
    await onCreate(username, firstMessage || undefined);
    setSubmitting(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Створити чат"
      className={clsx(styles.createModal, expanded && styles.createModalExpanded)}
    >
      <form className={clsx(styles.createForm, expanded && styles.createFormExpanded)} onSubmit={submit}>
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

        <label className={clsx(styles.createLabel, expanded && styles.createMessageField)}>
          Перше повідомлення (необов'язково)
          <div className={clsx(styles.createTextareaWrap, expanded && styles.createTextareaWrapHint)}>
            <textarea
              className={clsx(styles.createTextarea, expanded && styles.createTextareaExpanded, "fv-native-scrollbar")}
              value={firstMessage}
              onChange={(event) => setFirstMessage(event.target.value)}
              placeholder="Напишіть перше повідомлення..."
              rows={expanded ? 10 : 3}
              title={expanded ? "Потягніть за нижній правий кут для зміни розміру" : undefined}
            />
            {expanded ? (
              <span className={styles.createResizeHintLabel} aria-hidden="true">
                ↘
              </span>
            ) : null}
          </div>
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
