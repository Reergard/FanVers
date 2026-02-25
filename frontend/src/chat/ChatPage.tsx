import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import styles from "./Chat.module.css";
import { ChatList } from "./components/ChatList";
import { ChatWindow } from "./components/ChatWindow";
import { CreateChatModal } from "./components/CreateChatModal";
import { useChat } from "./store/useChat";
import { getChatStoreSnapshot } from "./store/chatStore";
import { chatWs } from "./ws/chatWs";
import type { ChatMessage } from "./api/types";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";

export default function ChatPage() {
  const { isAuthenticated, authReady, username, userId } = useAuth();
  const { state, actions } = useChat();
  const { showWarning, showError } = useNotification();
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    actions.fetchChats();
  }, [actions, authReady, isAuthenticated]);

  useEffect(() => {
    const syncOnVisibility = () => {
      if (document.visibilityState === "visible" && isAuthenticated) {
        actions.fetchChats();
      }
    };
    document.addEventListener("visibilitychange", syncOnVisibility);
    return () => document.removeEventListener("visibilitychange", syncOnVisibility);
  }, [actions, isAuthenticated]);

  useEffect(() => {
    if (!authReady || !isAuthenticated || state.selectedChatId == null) {
      chatWs.disconnect();
      return;
    }

    chatWs.connect(state.selectedChatId);
    const handleChatMessage = ({ chatId, message }: { chatId: number; message: ChatMessage }) => {
      actions.handleIncomingMessage(chatId, message, username);
    };
    chatWs.onMessage(handleChatMessage);

    return () => {
      chatWs.offMessage(handleChatMessage);
      chatWs.disconnect();
    };
  }, [actions, authReady, isAuthenticated, state.selectedChatId, username]);

  const onSelectChat = useCallback(
    (chatId: number) => {
      actions.selectChat(chatId);
    },
    [actions]
  );

  const onCreateChat = useCallback(
    async (targetUsername: string, firstMessage?: string) => {
      const created = await actions.createChat(targetUsername, firstMessage);
      if (!created) {
        const latestError = getChatStoreSnapshot().error;
        const err = (latestError ?? "").toLowerCase();
        if (err.includes("уже существует") || err.includes("already exists")) {
          showWarning("Чат з цим користувачем вже створено.");
        } else {
          showError(latestError ?? "Не вдалося створити чат");
        }
        return;
      }
      setCreateOpen(false);
    },
    [actions, showError, showWarning]
  );

  const onLoadMessages = useCallback(
    (chatId: number) => actions.fetchMessages(chatId),
    [actions]
  );

  const onMarkRead = useCallback(
    async (chatId: number) => {
      actions.markReadLocal(chatId);
      await actions.markChatAsRead(chatId);
    },
    [actions]
  );

  const onDeleteChat = useCallback(
    (chatId: number) => actions.deleteChat(chatId),
    [actions]
  );

  const onFallbackSend = useCallback(
    (chatId: number, text: string, currentUsername: string | null) =>
      actions.sendMessageFallback(chatId, text, currentUsername),
    [actions]
  );

  const selectedChat = state.chats.find((chat) => chat.id === state.selectedChatId) ?? null;

  if (!authReady) {
    return (
      <section className={styles.page}>
        <div className={styles.layout}>
          <div className={styles.emptyState}>Завантаження…</div>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <ChatList
          chats={state.chats}
          selectedChatId={state.selectedChatId}
          currentUsername={username}
          onSelect={onSelectChat}
          onCreate={() => setCreateOpen(true)}
        />

        <ChatWindow
          selectedChat={selectedChat}
          currentUsername={username}
          currentUserId={userId}
          messages={state.selectedMessages}
          loadingMessages={state.isLoadingSelectedMessages}
          onLoadMessages={onLoadMessages}
          onMarkRead={onMarkRead}
          onDeleteChat={onDeleteChat}
          onFallbackSend={onFallbackSend}
        />
      </div>

      {state.error ? <p className={styles.errorLine}>{state.error}</p> : null}

      <CreateChatModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={onCreateChat} />
    </section>
  );
}
