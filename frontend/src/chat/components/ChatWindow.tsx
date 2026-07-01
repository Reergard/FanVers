import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import ghostBlueIcon from "../../assets/icons/Ghost.svg";
import sendIcon from "../../catalog/assets/icons/send.svg";
import { Modal } from "../../shared/Modal/Modal";
import { chatWs } from "../ws/chatWs";
import styles from "../Chat.module.css";
import type { ChatListItem, ChatMessage } from "../api/types";
import { resolveAvatarUrl } from "../../shared/avatar/resolveAvatarUrl";

type Props = {
  selectedChat: ChatListItem | null;
  currentUsername: string | null;
  currentUserId: number | null;
  currentUserAvatarUrl?: string | null;
  messages: ChatMessage[];
  loadingMessages: boolean;
  hasOlderMessages: boolean;
  loadingOlderMessages: boolean;
  onLoadMessages: (chatId: number) => Promise<void> | void;
  onLoadOlderMessages: (chatId: number) => Promise<void> | void;
  onMarkRead: (chatId: number) => Promise<void> | void;
  onDeleteChat: (chatId: number) => Promise<void> | void;
  onFallbackSend: (chatId: number, text: string, currentUsername: string | null) => Promise<void> | void;
};

function clsx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function normalizeUsername(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function getOtherParticipantName(chat: ChatListItem, currentUsername: string | null): string {
  const other =
    chat.participants.find((participant) => participant.username !== currentUsername) ?? chat.participants[0];
  return other?.username || "Невідомий користувач";
}

function getParticipantAvatar(
  chat: ChatListItem | null,
  username: string | null
): string {
  if (!chat || !username) return resolveAvatarUrl(null);
  const normalizedUsername = normalizeUsername(username);
  const participant = chat.participants.find(
    (item) => normalizeUsername(item.username) === normalizedUsername
  );
  return resolveAvatarUrl(participant?.profile_image ?? null);
}

export function ChatWindow({
  selectedChat,
  currentUsername,
  currentUserId,
  currentUserAvatarUrl,
  messages,
  loadingMessages,
  hasOlderMessages,
  loadingOlderMessages,
  onLoadMessages,
  onLoadOlderMessages,
  onMarkRead,
  onDeleteChat,
  onFallbackSend,
}: Props) {
  const [text, setText] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const messagesRef = useRef<HTMLUListElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const initializedChatRef = useRef<number | null>(null);
  /** Anchor for restoring internal scroll after prepending older messages */
  const scrollAnchorRef = useRef<{ top: number; height: number } | null>(null);
  const lastOlderTriggerRef = useRef(0);
  const [composerMultiline, setComposerMultiline] = useState(false);

  const chatId = selectedChat?.id ?? null;
  const otherUsername = useMemo(
    () => (selectedChat ? getOtherParticipantName(selectedChat, currentUsername) : null),
    [selectedChat, currentUsername]
  );
  const currentAvatar = useMemo(
    () =>
      currentUserAvatarUrl
        ? resolveAvatarUrl(currentUserAvatarUrl)
        : getParticipantAvatar(selectedChat, currentUsername),
    [currentUserAvatarUrl, selectedChat, currentUsername]
  );
  const otherAvatar = useMemo(
    () => getParticipantAvatar(selectedChat, otherUsername),
    [selectedChat, otherUsername]
  );

  useEffect(() => {
    if (chatId == null) {
      initializedChatRef.current = null;
      return;
    }
    if (initializedChatRef.current === chatId) return;
    initializedChatRef.current = chatId;

    onLoadMessages(chatId);
    onMarkRead(chatId);
  }, [chatId, onLoadMessages, onMarkRead]);

  /* ── Internal scroll: scroll the messages container to the bottom ── */
  const scrollToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    if (loadingMessages) return;
    if (!messagesRef.current) return;
    if (loadingOlderMessages) return;

    const anchor = scrollAnchorRef.current;
    if (anchor) {
      /* Older messages were prepended — keep the same content in view */
      const el = messagesRef.current;
      const growth = el.scrollHeight - anchor.height;
      el.scrollTop = anchor.top + growth;
      scrollAnchorRef.current = null;
      return;
    }

    /* Scroll messages container to bottom (before paint → no visible jump) */
    scrollToBottom();
    /* Safety fallback after browser finishes layout/paint */
    requestAnimationFrame(scrollToBottom);
  }, [messages.length, chatId, loadingMessages, loadingOlderMessages, scrollToBottom]);

  const loadOlderClick = () => {
    if (chatId == null || loadingOlderMessages || !hasOlderMessages) return;
    const el = messagesRef.current;
    if (el) {
      scrollAnchorRef.current = {
        top: el.scrollTop,
        height: el.scrollHeight,
      };
    }
    void onLoadOlderMessages(chatId);
  };

  const syncComposerHeight = useCallback(() => {
    const el = composerRef.current;
    if (!el) return;

    const style = getComputedStyle(el);
    const singleLine = Number.parseFloat(style.lineHeight) || 30;
    const maxBlock = Number.parseFloat(style.maxBlockSize) || 320;
    const hasNewline = text.includes("\n");

    el.style.height = "auto";
    const contentHeight = el.scrollHeight;

    if (!hasNewline && contentHeight <= singleLine + 3) {
      el.style.height = "";
      el.style.overflowY = "hidden";
      setComposerMultiline(false);
      return;
    }

    const next = Math.min(Math.max(contentHeight, singleLine), maxBlock);
    el.style.height = `${next}px`;
    el.style.overflowY = contentHeight > maxBlock ? "auto" : "hidden";
    setComposerMultiline(true);
  }, [text]);

  useLayoutEffect(() => {
    syncComposerHeight();
  }, [text, syncComposerHeight]);

  useEffect(() => {
    const onResize = () => syncComposerHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncComposerHeight]);

  /* Mobile: keep composer visible when virtual keyboard opens */
  const onComposerFocus = useCallback(() => {
    if (typeof window === "undefined" || window.innerWidth > 768) return;
    const scrollIntoComposer = () => {
      composerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    /* Delay lets the keyboard finish animating before we scroll */
    const timerId = setTimeout(scrollIntoComposer, 350);
    const vv = window.visualViewport;
    if (vv) {
      const handleVvResize = () => {
        composerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      };
      vv.addEventListener("resize", handleVvResize, { once: true });
    }
    return () => clearTimeout(timerId);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chatId) return;
    const normalized = text.trim();
    if (!normalized) return;

    const sentViaWs = chatWs.isConnectedTo(chatId) && chatWs.sendMessage(normalized);
    if (!sentViaWs) {
      await onFallbackSend(chatId, normalized, currentUsername);
    }
    setText("");
    requestAnimationFrame(scrollToBottom);
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submit(event as unknown as FormEvent<HTMLFormElement>);
  };

  const askDeleteChat = () => {
    setConfirmDeleteOpen(true);
  };

  const cancelDeleteChat = () => {
    if (deleting) return;
    setConfirmDeleteOpen(false);
  };

  const confirmDeleteChat = async () => {
    if (!selectedChat || deleting) return;
    setDeleting(true);
    await onDeleteChat(selectedChat.id);
    setDeleting(false);
    setConfirmDeleteOpen(false);
  };

  if (!selectedChat) {
    return (
      <section className={styles.chatPanel} aria-label="Чат">
        <div className={styles.emptyState}>Оберіть чат або створіть новий.</div>
      </section>
    );
  }

  return (
    <section className={styles.chatPanel} aria-label="Чат">
      <header className={styles.chatHeader}>
        <div className={styles.chatHeaderLeft}>
          <span className={styles.headerAvatarOrange}>
            <img className={styles.ghostOrange} src={otherAvatar} alt="" aria-hidden="true" />
          </span>

          <div className={styles.headerTitleRow}>
            <h1 className={styles.headerTitle}>{otherUsername}</h1>
          </div>
        </div>

        <div className={styles.chatHeaderActions}>
          <button type="button" className={styles.deleteChatBtn} onClick={askDeleteChat}>
            Видалити чат
          </button>
        </div>
      </header>

      <ul
        ref={messagesRef}
        className={styles.messages}
        role="log"
        aria-label="Повідомлення"
      >
        {hasOlderMessages ? (
          <li className={styles.loadOlderWrap}>
            <button
              type="button"
              className={styles.loadOlderBtn}
              onClick={loadOlderClick}
              disabled={loadingOlderMessages || loadingMessages}
            >
              {loadingOlderMessages ? "Завантаження…" : "Завантажити ранішні повідомлення"}
            </button>
          </li>
        ) : null}

        {loadingMessages ? <li className={styles.systemHint}>Завантаження повідомлень…</li> : null}
        {!loadingMessages && messages.length === 0 ? (
          <li className={styles.systemHint}>Повідомлень поки немає.</li>
        ) : null}

        {messages.map((message) => {
          const byId = currentUserId != null && message.sender.id != null && message.sender.id === currentUserId;
          const byUsername =
            normalizeUsername(currentUsername) !== "" &&
            normalizeUsername(message.sender.username) === normalizeUsername(currentUsername);
          const isOwn = byId || byUsername;
          return (
            <li
              key={message.id}
              className={clsx(styles.msgRow, isOwn ? styles.msgRowRight : styles.msgRowLeft)}
            >
              {!isOwn ? (
                <span className={styles.msgAvatarLeft} aria-hidden="true">
                  <img className={styles.ghostOrange} src={otherAvatar} alt="" />
                </span>
              ) : null}

              <p className={clsx(styles.msgText, isOwn ? styles.msgTextRight : styles.msgTextLeft)}>
                {message.content}
              </p>

              {isOwn ? (
                <span className={styles.msgAvatar} aria-hidden="true">
                  <img className={styles.ghost} src={currentAvatar || ghostBlueIcon} alt="" />
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <form className={styles.composer} aria-label="Надіслати повідомлення" onSubmit={submit}>
        <label className={clsx(styles.inputShell, composerMultiline && styles.inputShellMultiline)}>
          <textarea
            ref={composerRef}
            className={`${styles.input} fv-native-scrollbar`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onComposerKeyDown}
            onFocus={onComposerFocus}
            placeholder="Ваше повідомлення..."
            rows={1}
          />
          <button className={styles.sendBtn} type="submit" aria-label="Надіслати">
            <img className={styles.sendIconGraphic} src={sendIcon} alt="" aria-hidden="true" />
          </button>
        </label>
      </form>

      <Modal open={confirmDeleteOpen} onClose={cancelDeleteChat} title="Підтвердження видалення">
        <p className={styles.confirmText}>Ви впевнені що хочете видалити цей чат?</p>
        <div className={styles.confirmActions}>
          <button type="button" className={styles.createSecondaryBtn} onClick={cancelDeleteChat} disabled={deleting}>
            Ні
          </button>
          <button type="button" className={styles.createPrimaryBtn} onClick={confirmDeleteChat} disabled={deleting}>
            {deleting ? "Видалення..." : "Так"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
