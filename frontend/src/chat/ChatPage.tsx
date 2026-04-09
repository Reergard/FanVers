import { useCallback, useEffect, useState } from "react";
import type { ChatWsConnectionStatus } from "./ws/chatWs";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { useAuthModal } from "../auth/AuthModalContext";
import styles from "./Chat.module.css";
import { ChatList } from "./components/ChatList";
import { ChatWindow } from "./components/ChatWindow";
import { CreateChatModal } from "./components/CreateChatModal";
import { useChat } from "./store/useChat";
import { getChatStoreSnapshot } from "./store/chatStore";
import { chatWs } from "./ws/chatWs";
import type { ChatMessage } from "./api/types";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { Container } from "../shared/Container";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { getMyProfile } from "../users/profileService";
import { Breadcrumb } from "../navigation/Breadcrumb";
import { profileQueryKey } from "../shared/queryKeys";

export default function ChatPage() {
  const { isAuthenticated, authReady, username, userId } = useAuth();
  const { openLoginModal } = useAuthModal();
  const { state, actions } = useChat();
  const { showWarning, showError } = useNotification();
  const [createOpen, setCreateOpen] = useState(false);
  const [chatWsStatus, setChatWsStatus] = useState<ChatWsConnectionStatus>("disconnected");

  useEffect(() => {
    return chatWs.subscribeConnectionStatus(setChatWsStatus);
  }, []);
  const profileQuery = useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: getMyProfile,
    enabled: authReady && isAuthenticated,
    staleTime: 60_000,
  });

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
        if (
          err.includes("уже существует") ||
          err.includes("already exists") ||
          err.includes("вже існує")
        ) {
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

  const onLoadOlderMessages = useCallback(
    (chatId: number) => actions.fetchOlderMessages(chatId),
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
        <Container>
          <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Чат" }]} />
          <div className={styles.emptyState}>Завантаження…</div>
        </Container>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className={styles.page}>
        <Container>
          <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Чат" }]} />
          <div style={{ padding: "48px 24px", textAlign: "center", color: "rgba(255,255,255,0.8)" }}>
            <h2 style={{ marginBottom: "16px" }}>Для перегляду чатів необхідно увійти в систему</h2>
            <p style={{ marginBottom: "24px" }}>Увійдіть або зареєструйтесь, щоб мати доступ до чатів</p>
            <ActionButton variant="primary" onClick={() => openLoginModal("/chat")}>
              Увійти
            </ActionButton>
          </div>
        </Container>
      </section>
    );
  }

  return (
      <section className={styles.page}>
        <Container>
          <div className={styles.chatTopBar}>
            <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Чат" }]} />
            {state.selectedChatId != null ? (
              <span
                className={styles.wsBadge}
                data-status={chatWsStatus}
                title={
                  chatWsStatus === "connected"
                    ? "З'єднання з чатом активне"
                    : chatWsStatus === "reconnecting"
                      ? "Відновлюємо з'єднання…"
                      : "Немає з'єднання з чатом"
                }
              >
                {chatWsStatus === "connected"
                  ? "Чат онлайн"
                  : chatWsStatus === "reconnecting"
                    ? "Підключення…"
                    : "Чат офлайн"}
              </span>
            ) : null}
          </div>
        </Container>
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
          currentUserAvatarUrl={
            profileQuery.data?.has_custom_image === false
              ? null
              : (profileQuery.data?.profile_image_small ??
                profileQuery.data?.profile_image_large ??
                profileQuery.data?.image ??
                null)
          }
          messages={state.selectedMessages}
          loadingMessages={state.isLoadingSelectedMessages}
          hasOlderMessages={state.hasOlderMessages}
          loadingOlderMessages={state.isLoadingOlderSelected}
          onLoadMessages={onLoadMessages}
          onLoadOlderMessages={onLoadOlderMessages}
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
