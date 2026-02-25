import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import ghostBlueIcon from "../../assets/icons/Ghost.svg";
import ghostOrangeIcon from "../../assets/icons/Ghost_orange.svg";
import sendIcon from "../../catalog/assets/icons/send.svg";
import { Modal } from "../../shared/Modal/Modal";
import { chatWs } from "../ws/chatWs";
import styles from "../Chat.module.css";
import type { ChatListItem, ChatMessage } from "../api/types";

type Props = {
  selectedChat: ChatListItem | null;
  currentUsername: string | null;
  currentUserId: number | null;
  messages: ChatMessage[];
  loadingMessages: boolean;
  onLoadMessages: (chatId: number) => Promise<void> | void;
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

export function ChatWindow({
  selectedChat,
  currentUsername,
  currentUserId,
  messages,
  loadingMessages,
  onLoadMessages,
  onMarkRead,
  onDeleteChat,
  onFallbackSend,
}: Props) {
  const [text, setText] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const messagesRef = useRef<HTMLUListElement | null>(null);
  const initializedChatRef = useRef<number | null>(null);

  const chatId = selectedChat?.id ?? null;
  const otherUsername = useMemo(
    () => (selectedChat ? getOtherParticipantName(selectedChat, currentUsername) : null),
    [selectedChat, currentUsername]
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

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages.length, chatId]);

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
            <img className={styles.ghostOrange} src={ghostOrangeIcon} alt="" aria-hidden="true" />
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

      <ul ref={messagesRef} className={styles.messages} role="log" aria-label="Повідомлення">
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
                  <img className={styles.ghostOrange} src={ghostOrangeIcon} alt="" />
                </span>
              ) : null}

              <p className={clsx(styles.msgText, isOwn ? styles.msgTextRight : styles.msgTextLeft)}>
                {message.content}
              </p>

              {isOwn ? (
                <span className={styles.msgAvatar} aria-hidden="true">
                  <img className={styles.ghost} src={ghostBlueIcon} alt="" />
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <form className={styles.composer} aria-label="Надіслати повідомлення" onSubmit={submit}>
        <label className={styles.inputShell}>
          <input
            className={styles.input}
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Ваше повідомлення..."
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
