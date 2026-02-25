import { getAccess } from "../../auth/token";
import type { ChatMessage } from "../api/types";

type Handler = (payload: { chatId: number; message: ChatMessage }) => void;

type WireMessage = {
  id?: number;
  message?: string;
  sender?: { id?: number; username?: string };
  timestamp?: string;
  created_at?: string;
};

function resolveWsBaseUrl(): string {
  const wsBase = (import.meta.env.VITE_WS_BASE_URL as string | undefined)?.trim();
  if (wsBase) return wsBase.replace(/\/+$/, "");

  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (apiBase) {
    const normalized = apiBase.replace(/\/+$/, "");
    if (normalized.startsWith("https://")) return normalized.replace("https://", "wss://");
    if (normalized.startsWith("http://")) return normalized.replace("http://", "ws://");
  }

  if (import.meta.env.DEV) return "ws://127.0.0.1:8000";

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}`;
}

function toChatMessage(raw: WireMessage): ChatMessage | null {
  const id = Number(raw.id);
  const content = typeof raw.message === "string" ? raw.message : "";
  if (Number.isNaN(id) || !content) return null;

  return {
    id,
    content,
    sender: {
      id: Number.isNaN(Number(raw.sender?.id)) ? undefined : Number(raw.sender?.id),
      username: raw.sender?.username ?? "",
    },
    created_at: raw.created_at ?? raw.timestamp ?? new Date().toISOString(),
  };
}

class ChatWsService {
  private socket: WebSocket | null = null;
  private chatId: number | null = null;
  private handlers = new Set<Handler>();

  connect(chatId: number): boolean {
    const token = getAccess();
    if (!token) return false;

    if (this.socket && this.chatId === chatId && this.socket.readyState <= WebSocket.OPEN) {
      return true;
    }

    this.disconnect();

    const base = resolveWsBaseUrl();
    const url = `${base}/ws/chat/${chatId}/?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url);
    this.socket = socket;
    this.chatId = chatId;

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WireMessage;
        const message = toChatMessage(parsed);
        if (!message || this.chatId == null) return;
        for (const handler of this.handlers) {
          handler({ chatId: this.chatId, message });
        }
      } catch {
        // Skip malformed ws frames to avoid breaking connection lifecycle.
      }
    };

    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null;
      }
    };

    socket.onerror = () => {
      // Browser will call onclose afterwards, no-op here.
    };

    return true;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
    }
    this.socket = null;
    this.chatId = null;
  }

  isConnectedTo(chatId: number): boolean {
    return this.chatId === chatId && this.socket?.readyState === WebSocket.OPEN;
  }

  sendMessage(text: string): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ message: text }));
    return true;
  }

  onMessage(handler: Handler): void {
    this.handlers.add(handler);
  }

  offMessage(handler: Handler): void {
    this.handlers.delete(handler);
  }
}

export const chatWs = new ChatWsService();
