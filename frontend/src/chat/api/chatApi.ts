import { http } from "../../api/http";
import { API } from "../../api/endpoints";
import type {
  ChatListItem,
  ChatMessage,
  ChatUserSearchHit,
  CreateChatPayload,
  MessagesPage,
  SendMessagePayload,
} from "./types";

function normalizeMessage(raw: unknown): ChatMessage | null {
  if (raw == null || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id = Number(obj.id);
  const content = typeof obj.content === "string" ? obj.content : "";
  const senderRaw = obj.sender;
  const sender =
    senderRaw != null &&
    typeof senderRaw === "object" &&
    typeof (senderRaw as Record<string, unknown>).username === "string"
      ? { username: String((senderRaw as Record<string, unknown>).username) }
      : { username: "" };
  const senderIdRaw =
    senderRaw != null && typeof senderRaw === "object"
      ? (senderRaw as Record<string, unknown>).id
      : undefined;
  const senderId = Number(senderIdRaw);
  const createdAt =
    typeof obj.created_at === "string"
      ? obj.created_at
      : typeof obj.timestamp === "string"
        ? obj.timestamp
        : new Date().toISOString();

  if (Number.isNaN(id) || !content) return null;

  return {
    id,
    content,
    sender: {
      ...sender,
      id: Number.isNaN(senderId) ? undefined : senderId,
    },
    created_at: createdAt,
  };
}

/** DRF інколи віддає пагінацію { results: [...] } замість сирого масиву. */
function extractResultsArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data != null && typeof data === "object" && Array.isArray((data as Record<string, unknown>).results)) {
    return (data as Record<string, unknown>).results as unknown[];
  }
  return [];
}

function normalizeChat(raw: unknown): ChatListItem | null {
  if (raw == null || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id = Number(obj.id);
  if (Number.isNaN(id)) return null;

  const participantsRaw = Array.isArray(obj.participants) ? obj.participants : [];
  const participants = participantsRaw
    .map((item) => {
      if (item == null || typeof item !== "object") return null;
      const p = item as Record<string, unknown>;
      const participantId = Number(p.id);
      const uRaw = p.username;
      const username =
        typeof uRaw === "string"
          ? uRaw.trim()
          : uRaw != null && String(uRaw).trim()
            ? String(uRaw).trim()
            : typeof p.email === "string" && p.email.trim()
              ? p.email.trim()
              : "";
      if (Number.isNaN(participantId) || !username) return null;
      return {
        id: participantId,
        username,
        profile_image: typeof p.profile_image === "string" ? p.profile_image : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  return {
    id,
    participants,
    last_message: normalizeMessage(obj.last_message),
    unread_count: Number.isFinite(Number(obj.unread_count)) ? Number(obj.unread_count) : 0,
  };
}

export async function getChats(): Promise<ChatListItem[]> {
  const response = await http.get<unknown>(API.chat.list);
  const list = extractResultsArray(response.data);
  return list.map(normalizeChat).filter((item): item is ChatListItem => item != null);
}

export async function getChat(chatId: number): Promise<ChatListItem | null> {
  const response = await http.get<unknown>(API.chat.byId(chatId));
  return normalizeChat(response.data);
}

function normalizeMessagesPage(raw: unknown): MessagesPage {
  if (raw == null || typeof raw !== "object") {
    return { results: [], next_before: null };
  }
  const obj = raw as Record<string, unknown>;
  const list = Array.isArray(obj.results) ? obj.results : [];
  const results = list.map(normalizeMessage).filter((item): item is ChatMessage => item != null);
  const nb = obj.next_before;
  let next_before: number | null = null;
  if (typeof nb === "number" && !Number.isNaN(nb)) next_before = nb;
  else if (typeof nb === "string" && nb !== "" && !Number.isNaN(Number(nb))) next_before = Number(nb);
  return { results, next_before };
}

function normalizeSearchUser(raw: unknown): ChatUserSearchHit | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  const username = typeof o.username === "string" ? o.username : "";
  if (Number.isNaN(id) || !username) return null;
  const pu = o.profile_username;
  return {
    id,
    username,
    profile_username: typeof pu === "string" && pu ? pu : null,
    profile_image: typeof o.profile_image === "string" ? o.profile_image : null,
  };
}

export async function getChatMessagesPage(
  chatId: number,
  opts?: { before?: number; limit?: number }
): Promise<MessagesPage> {
  const params: Record<string, string> = {};
  if (opts?.before != null) params.before = String(opts.before);
  if (opts?.limit != null) params.limit = String(opts.limit);
  const response = await http.get<unknown>(API.chat.messages(chatId), { params });
  return normalizeMessagesPage(response.data);
}

export async function searchChatUsers(q: string): Promise<ChatUserSearchHit[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const response = await http.get<unknown>(API.chat.userSearch, { params: { q: query } });
  const data = response.data;
  if (data == null || typeof data !== "object") return [];
  const list = Array.isArray((data as Record<string, unknown>).results)
    ? ((data as Record<string, unknown>).results as unknown[])
    : [];
  return list.map(normalizeSearchUser).filter((item): item is ChatUserSearchHit => item != null);
}

export async function createChat(payload: CreateChatPayload): Promise<ChatListItem> {
  const response = await http.post<unknown>(API.chat.create, payload);
  const normalized = normalizeChat(response.data);
  if (!normalized) throw new Error("Некоректна відповідь сервера при створенні чату");
  return normalized;
}

export async function deleteChat(chatId: number): Promise<void> {
  await http.delete(API.chat.byId(chatId));
}

export async function markChatAsRead(chatId: number): Promise<void> {
  await http.post(API.chat.markAsRead(chatId));
}

export async function sendMessage(chatId: number, payload: SendMessagePayload): Promise<ChatMessage> {
  const response = await http.post<unknown>(API.chat.sendMessage(chatId), payload);
  const normalized = normalizeMessage(response.data);
  if (!normalized) throw new Error("Некоректна відповідь сервера при відправці повідомлення");
  return normalized;
}

export const chatApi = {
  getChats,
  getChat,
  getChatMessagesPage,
  searchChatUsers,
  createChat,
  deleteChat,
  markChatAsRead,
  sendMessage,
};
