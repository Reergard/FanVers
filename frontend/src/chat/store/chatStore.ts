import { chatApi } from "../api/chatApi";
import type { ChatListItem, ChatMessage } from "../api/types";

type Listener = () => void;

type ChatStoreState = {
  chats: ChatListItem[];
  messagesByChatId: Record<number, ChatMessage[]>;
  selectedChatId: number | null;
  loadingChats: boolean;
  loadingMessages: Record<number, boolean>;
  error: string | null;
  unreadTotal: number;
};

const listeners = new Set<Listener>();
let storeVersion = 0;
let cachedVersion = -1;
let cachedSnapshot: ChatStoreState | null = null;

const state: ChatStoreState = {
  chats: [],
  messagesByChatId: {},
  selectedChatId: null,
  loadingChats: false,
  loadingMessages: {},
  error: null,
  unreadTotal: 0,
};

function emit(): void {
  storeVersion++;
  for (const listener of listeners) listener();
}

function setState(mutator: (draft: ChatStoreState) => void): void {
  mutator(state);
  emit();
}

function sortChatsByLastMessage(chats: ChatListItem[]): ChatListItem[] {
  return [...chats].sort((a, b) => {
    const aDate = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
    const bDate = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
    return bDate - aDate;
  });
}

function recalcUnreadTotalInternal(draft: ChatStoreState): void {
  draft.unreadTotal = draft.chats.reduce((sum, chat) => sum + (chat.unread_count ?? 0), 0);
}

function upsertChatFromMessage(
  draft: ChatStoreState,
  chatId: number,
  message: ChatMessage,
  currentUsername: string | null
): void {
  const index = draft.chats.findIndex((chat) => chat.id === chatId);
  if (index === -1) return;

  const existing = draft.chats[index];
  const isOwnMessage = currentUsername != null && message.sender.username === currentUsername;
  const isSelectedNow = draft.selectedChatId === chatId;

  draft.chats[index] = {
    ...existing,
    last_message: message,
    unread_count: isOwnMessage || isSelectedNow ? 0 : (existing.unread_count ?? 0) + 1,
  };
  draft.chats = sortChatsByLastMessage(draft.chats);
  recalcUnreadTotalInternal(draft);
}

function appendMessageInternal(draft: ChatStoreState, chatId: number, message: ChatMessage): void {
  const current = draft.messagesByChatId[chatId] ?? [];
  if (current.some((item) => item.id === message.id)) return;
  draft.messagesByChatId = {
    ...draft.messagesByChatId,
    [chatId]: [...current, message],
  };
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    const maybeAxios = error as Error & {
      response?: { data?: { error?: unknown; detail?: unknown } };
    };
    const apiError = maybeAxios.response?.data?.error;
    if (typeof apiError === "string" && apiError.trim()) return apiError;
    const apiDetail = maybeAxios.response?.data?.detail;
    if (typeof apiDetail === "string" && apiDetail.trim()) return apiDetail;
    return error.message;
  }
  return fallback;
}

export function subscribeChat(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getChatStoreSnapshot(): ChatStoreState {
  if (cachedSnapshot && cachedVersion === storeVersion) {
    return cachedSnapshot;
  }

  cachedVersion = storeVersion;
  cachedSnapshot = {
    chats: [...state.chats],
    messagesByChatId: { ...state.messagesByChatId },
    selectedChatId: state.selectedChatId,
    loadingChats: state.loadingChats,
    loadingMessages: { ...state.loadingMessages },
    error: state.error,
    unreadTotal: state.unreadTotal,
  };
  return cachedSnapshot;
}

export const chatStore = {
  async fetchChats(): Promise<void> {
    setState((draft) => {
      draft.loadingChats = true;
      draft.error = null;
    });
    try {
      const chats = await chatApi.getChats();
      setState((draft) => {
        draft.chats = sortChatsByLastMessage(chats);
        if (draft.selectedChatId != null && !draft.chats.some((chat) => chat.id === draft.selectedChatId)) {
          draft.selectedChatId = draft.chats[0]?.id ?? null;
        }
        if (draft.selectedChatId == null && draft.chats.length > 0) {
          draft.selectedChatId = draft.chats[0].id;
        }
        draft.loadingChats = false;
        recalcUnreadTotalInternal(draft);
      });
    } catch (error) {
      setState((draft) => {
        draft.loadingChats = false;
        draft.error = error instanceof Error ? error.message : "Не вдалося завантажити чати";
      });
    }
  },

  selectChat(chatId: number | null): void {
    if (state.selectedChatId === chatId) return;
    setState((draft) => {
      draft.selectedChatId = chatId;
    });
  },

  async fetchMessages(chatId: number): Promise<void> {
    if (state.loadingMessages[chatId]) return;
    setState((draft) => {
      draft.loadingMessages = { ...draft.loadingMessages, [chatId]: true };
      draft.error = null;
    });
    try {
      const messages = await chatApi.getChatMessages(chatId);
      setState((draft) => {
        draft.messagesByChatId = { ...draft.messagesByChatId, [chatId]: messages };
        draft.loadingMessages = { ...draft.loadingMessages, [chatId]: false };
      });
    } catch (error) {
      setState((draft) => {
        draft.loadingMessages = { ...draft.loadingMessages, [chatId]: false };
        draft.error = error instanceof Error ? error.message : "Не вдалося завантажити повідомлення";
      });
    }
  },

  async createChat(username: string, message?: string): Promise<ChatListItem | null> {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) return null;
    try {
      const chat = await chatApi.createChat({ username: normalizedUsername, message: message?.trim() || undefined });
      setState((draft) => {
        draft.chats = sortChatsByLastMessage([chat, ...draft.chats.filter((item) => item.id !== chat.id)]);
        draft.selectedChatId = chat.id;
        recalcUnreadTotalInternal(draft);
      });
      return chat;
    } catch (error) {
      setState((draft) => {
        draft.error = resolveErrorMessage(error, "Не вдалося створити чат");
      });
      return null;
    }
  },

  async deleteChat(chatId: number): Promise<void> {
    try {
      await chatApi.deleteChat(chatId);
      setState((draft) => {
        draft.chats = draft.chats.filter((chat) => chat.id !== chatId);
        const nextMessages = { ...draft.messagesByChatId };
        delete nextMessages[chatId];
        draft.messagesByChatId = nextMessages;
        if (draft.selectedChatId === chatId) {
          draft.selectedChatId = draft.chats[0]?.id ?? null;
        }
        recalcUnreadTotalInternal(draft);
      });
    } catch (error) {
      setState((draft) => {
        draft.error = error instanceof Error ? error.message : "Не вдалося видалити чат";
      });
    }
  },

  appendMessage(chatId: number, message: ChatMessage): void {
    setState((draft) => {
      appendMessageInternal(draft, chatId, message);
    });
  },

  handleIncomingMessage(chatId: number, message: ChatMessage, currentUsername: string | null): void {
    setState((draft) => {
      appendMessageInternal(draft, chatId, message);
      upsertChatFromMessage(draft, chatId, message, currentUsername);
    });
  },

  markReadLocal(chatId: number): void {
    const target = state.chats.find((chat) => chat.id === chatId);
    if (!target) return;
    if ((target.unread_count ?? 0) === 0) return;

    setState((draft) => {
      draft.chats = draft.chats.map((chat) =>
        chat.id === chatId ? { ...chat, unread_count: 0 } : chat
      );
      recalcUnreadTotalInternal(draft);
    });
  },

  async markChatAsRead(chatId: number): Promise<void> {
    try {
      await chatApi.markChatAsRead(chatId);
    } catch {
      // Keep optimistic local unread reset even if network call failed.
    }
  },

  setChatUnread(chatId: number, unread: number): void {
    setState((draft) => {
      draft.chats = draft.chats.map((chat) =>
        chat.id === chatId ? { ...chat, unread_count: Math.max(0, unread) } : chat
      );
      recalcUnreadTotalInternal(draft);
    });
  },

  applyCounterEvent(chatId: number, message: ChatMessage, currentUsername: string | null): void {
    setState((draft) => {
      upsertChatFromMessage(draft, chatId, message, currentUsername);
    });
  },

  async sendMessageFallback(chatId: number, content: string, currentUsername: string | null): Promise<void> {
    const text = content.trim();
    if (!text) return;
    try {
      const message = await chatApi.sendMessage(chatId, { content: text });
      setState((draft) => {
        appendMessageInternal(draft, chatId, message);
        upsertChatFromMessage(draft, chatId, message, currentUsername);
      });
    } catch (error) {
      setState((draft) => {
        draft.error = error instanceof Error ? error.message : "Не вдалося надіслати повідомлення";
      });
    }
  },
};
