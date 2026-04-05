import ghostIcon from "../../assets/icons/Ghost.svg";
import chatFrameIcon from "../../assets/icons/рамкаsvg.svg";
import styles from "../Chat.module.css";
import type { ChatListItem } from "../api/types";
import { resolveAvatarUrl } from "../../shared/avatar/resolveAvatarUrl";

type Props = {
  chats: ChatListItem[];
  selectedChatId: number | null;
  currentUsername: string | null;
  onSelect: (chatId: number) => void;
  onCreate: () => void;
};

function clsx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function getOtherParticipantName(chat: ChatListItem, currentUsername: string | null): string {
  const other =
    chat.participants.find((participant) => participant.username !== currentUsername) ?? chat.participants[0];
  return other?.username || "Невідомий користувач";
}

function getOtherParticipantAvatar(chat: ChatListItem, currentUsername: string | null): string {
  const other =
    chat.participants.find((participant) => participant.username !== currentUsername) ?? chat.participants[0];
  return resolveAvatarUrl(other?.profile_image ?? null);
}

export function ChatList({ chats, selectedChatId, currentUsername, onSelect, onCreate }: Props) {
  return (
    <aside className={styles.sidebar} aria-label="Список чатів">
      <p className={styles.brand}>ChatVers</p>

      <button type="button" className={styles.createChat} onClick={onCreate}>
        <img className={styles.createFrame} src={chatFrameIcon} alt="" aria-hidden="true" />
        <span className={styles.createTitle}>Створити чат</span>
      </button>

      <nav className={styles.chatList} aria-label="Чати">
        <ul className={styles.chatListInner}>
          {chats.map((chat) => {
            const otherUsername = getOtherParticipantName(chat, currentUsername);
            const otherAvatar = getOtherParticipantAvatar(chat, currentUsername);
            return (
              <li key={chat.id}>
                <button
                  type="button"
                  onClick={() => onSelect(chat.id)}
                  className={clsx(styles.chatItem, chat.id === selectedChatId && styles.chatItemActive)}
                >
                  <span className={styles.chatAvatar}>
                    <img className={styles.ghost} src={otherAvatar || ghostIcon} alt="" aria-hidden="true" />
                  </span>

                  <span className={styles.chatMeta}>
                    <span className={styles.chatName}>{otherUsername}</span>
                    <span className={styles.chatPreview}>{chat.last_message?.content || "\u00A0"}</span>
                  </span>

                  {(chat.unread_count ?? 0) > 0 ? (
                    <span
                      className={styles.unreadBadge}
                      aria-label={`${chat.unread_count} непрочитаних`}
                    >
                      {chat.unread_count}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
