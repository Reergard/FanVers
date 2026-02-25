import { http } from "../../api/http";
import { API } from "../../api/endpoints";
import type { ChatListItem, ChatMessage, CreateChatPayload, SendMessagePayload } from "./types";

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
      const username = typeof p.username === "string" ? p.username : "";
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
  const list = Array.isArray(response.data) ? response.data : [];
  return list.map(normalizeChat).filter((item): item is ChatListItem => item != null);
}

export async function getChatMessages(chatId: number): Promise<ChatMessage[]> {
  const response = await http.get<unknown>(API.chat.messages(chatId));
  const list = Array.isArray(response.data) ? response.data : [];
  return list.map(normalizeMessage).filter((item): item is ChatMessage => item != null);
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
  getChatMessages,
  createChat,
  deleteChat,
  markChatAsRead,
  sendMessage,
};
