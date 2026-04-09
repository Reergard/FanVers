import { isAxiosError } from "axios";
import { chatApi } from "../api/chatApi";
import type { ChatListItem, ChatMessage } from "../api/types";

type Listener = () => void;

type ChatStoreState = {
  chats: ChatListItem[];
  messagesByChatId: Record<number, ChatMessage[]>;
  /** Наступний курсор для підвантаження старіших (id повідомлення для ?before=); null — більше немає */
  messagesOlderCursor: Record<number, number | null>;
  selectedChatId: number | null;
  loadingChats: boolean;
  loadingMessages: Record<number, boolean>;
  loadingOlderMessages: Record<number, boolean>;
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
  messagesOlderCursor: {},
  selectedChatId: null,
  loadingChats: false,
  loadingMessages: {},
  loadingOlderMessages: {},
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

function mergeMessagesById(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const m = new Map<number, ChatMessage>();
  for (const x of a) m.set(x.id, x);
  for (const x of b) m.set(x.id, x);
  return [...m.values()].sort((x, y) => x.id - y.id);
}

function appendMessageInternal(draft: ChatStoreState, chatId: number, message: ChatMessage): void {
  const current = draft.messagesByChatId[chatId] ?? [];
  if (current.some((item) => item.id === message.id)) return;
  draft.messagesByChatId = {
    ...draft.messagesByChatId,
    [chatId]: mergeMessagesById(current, [message]),
  };
}

function firstStringFromDrfField(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string" && value[0].trim()) {
    return value[0].trim();
  }
  return null;
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    if (data != null && typeof data === "object") {
      const rec = data as Record<string, unknown>;
      const fromError = firstStringFromDrfField(rec.error);
      if (fromError) return fromError;
      const fromDetail = firstStringFromDrfField(rec.detail);
      if (fromDetail) return fromDetail;
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
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
    messagesOlderCursor: { ...state.messagesOlderCursor },
    selectedChatId: state.selectedChatId,
    loadingChats: state.loadingChats,
    loadingMessages: { ...state.loadingMessages },
    loadingOlderMessages: { ...state.loadingOlderMessages },
    error: state.error,
    unreadTotal: state.unreadTotal,
  };
  return cachedSnapshot;
}

export const chatStore = {
  async fetchChats(): Promise<void> {
    if (state.loadingChats) return;

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
        draft.error = resolveErrorMessage(error, "Не вдалося завантажити чати");
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
      const page = await chatApi.getChatMessagesPage(chatId);
      setState((draft) => {
        draft.messagesByChatId = { ...draft.messagesByChatId, [chatId]: page.results };
        draft.messagesOlderCursor = {
          ...draft.messagesOlderCursor,
          [chatId]: page.next_before,
        };
        draft.loadingMessages = { ...draft.loadingMessages, [chatId]: false };
      });
    } catch (error) {
      setState((draft) => {
        draft.loadingMessages = { ...draft.loadingMessages, [chatId]: false };
        draft.error = resolveErrorMessage(error, "Не вдалося завантажити повідомлення");
      });
    }
  },

  async fetchOlderMessages(chatId: number): Promise<void> {
    const cursor = state.messagesOlderCursor[chatId];
    if (typeof cursor !== "number") return;
    if (state.loadingOlderMessages[chatId] || state.loadingMessages[chatId]) return;
    setState((draft) => {
      draft.loadingOlderMessages = { ...draft.loadingOlderMessages, [chatId]: true };
      draft.error = null;
    });
    try {
      const page = await chatApi.getChatMessagesPage(chatId, { before: cursor });
      setState((draft) => {
        const cur = draft.messagesByChatId[chatId] ?? [];
        draft.messagesByChatId[chatId] = mergeMessagesById(page.results, cur);
        draft.messagesOlderCursor[chatId] = page.next_before;
        draft.loadingOlderMessages = { ...draft.loadingOlderMessages, [chatId]: false };
      });
    } catch (error) {
      setState((draft) => {
        draft.loadingOlderMessages = { ...draft.loadingOlderMessages, [chatId]: false };
        draft.error = resolveErrorMessage(error, "Не вдалося завантажити старіші повідомлення");
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
      if (isAxiosError(error) && error.response?.status === 400) {
        const data = error.response.data;
        if (data != null && typeof data === "object") {
          const cid = Number((data as Record<string, unknown>).chat_id);
          if (!Number.isNaN(cid)) {
            try {
              let existing = await chatApi.getChat(cid);
              if (!existing) {
                await chatStore.fetchChats();
                existing = getChatStoreSnapshot().chats.find((c) => c.id === cid) ?? null;
              }
              if (existing) {
                setState((draft) => {
                  draft.chats = sortChatsByLastMessage([
                    existing,
                    ...draft.chats.filter((item) => item.id !== existing.id),
                  ]);
                  draft.selectedChatId = existing.id;
                  recalcUnreadTotalInternal(draft);
                  draft.error = null;
                });
                return existing;
              }
            } catch {
              /* fall through */
            }
          }
        }
      }
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
        const nextCursor = { ...draft.messagesOlderCursor };
        delete nextCursor[chatId];
        draft.messagesOlderCursor = nextCursor;
        const nextOlder = { ...draft.loadingOlderMessages };
        delete nextOlder[chatId];
        draft.loadingOlderMessages = nextOlder;
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

  applyCounterEvent(
    chatId: number,
    message: ChatMessage | null,
    currentUsername: string | null,
    unreadCount?: number
  ): void {
    const chatExists = state.chats.some((c) => c.id === chatId);
    if (!chatExists) {
      if (!state.loadingChats) {
        void chatStore.fetchChats();
      }
      return;
    }

    setState((draft) => {
      const index = draft.chats.findIndex((c) => c.id === chatId);
      if (index === -1) return;

      if (unreadCount !== undefined) {
        const existing = draft.chats[index];
        draft.chats[index] = {
          ...existing,
          unread_count: unreadCount,
          ...(message ? { last_message: message } : {}),
        };
        if (message) {
          draft.chats = sortChatsByLastMessage(draft.chats);
        }
        recalcUnreadTotalInternal(draft);
        return;
      }

      if (message) {
        upsertChatFromMessage(draft, chatId, message, currentUsername);
      }
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
