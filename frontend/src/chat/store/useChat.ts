import { useSyncExternalStore } from "react";
import { chatStore, getChatStoreSnapshot, subscribeChat } from "./chatStore";

export function useChat() {
  const snapshot = useSyncExternalStore(subscribeChat, getChatStoreSnapshot, getChatStoreSnapshot);
  const selectedMessages =
    snapshot.selectedChatId != null ? snapshot.messagesByChatId[snapshot.selectedChatId] ?? [] : [];
  const isLoadingSelectedMessages =
    snapshot.selectedChatId != null ? Boolean(snapshot.loadingMessages[snapshot.selectedChatId]) : false;
  const selectedOlderCursor =
    snapshot.selectedChatId != null ? snapshot.messagesOlderCursor[snapshot.selectedChatId] : undefined;
  const hasOlderMessages = typeof selectedOlderCursor === "number";
  const isLoadingOlderSelected =
    snapshot.selectedChatId != null ? Boolean(snapshot.loadingOlderMessages[snapshot.selectedChatId]) : false;

  return {
    state: {
      chats: snapshot.chats,
      messagesByChatId: snapshot.messagesByChatId,
      selectedChatId: snapshot.selectedChatId,
      selectedMessages,
      loadingChats: snapshot.loadingChats,
      isLoadingSelectedMessages,
      hasOlderMessages,
      isLoadingOlderSelected,
      error: snapshot.error,
      unreadTotal: snapshot.unreadTotal,
    },
    actions: chatStore,
  };
}
