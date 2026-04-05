import type { ChatMessage } from "../api/types";

type Handler = (payload: { chatId: number; message: ChatMessage }) => void;

type WireMessage = {
  id?: number;
  message?: string;
  sender?: { id?: number; username?: string };
  timestamp?: string;
  created_at?: string;
};

/** WebSocket base URL. Cookie-based auth — токен в URL не передається (OWASP). */
function resolveWsBaseUrl(): string {
  const wsBase = (import.meta.env.VITE_WS_BASE_URL as string | undefined)?.trim();
  if (wsBase) return wsBase.replace(/\/+$/, "");

  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (apiBase) {
    const normalized = apiBase.replace(/\/+$/, "");
    if (normalized.startsWith("https://")) return normalized.replace("https://", "wss://");
    if (normalized.startsWith("http://")) return normalized.replace("http://", "ws://");
  }

  // Dev: порожній base = same-origin, Vite proxy /ws → backend
  if (import.meta.env.DEV) return "";

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
  /** Кімната, до якої прагнемо залишитись підключеними (реконект після обриву). */
  private targetChatId: number | null = null;
  /** chatId сокета, що щойно закрився — щоб не реконектити після перемикання чату. */
  private activeSocketChatId: number | null = null;
  private handlers = new Set<Handler>();
  private shouldReconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(chatId: number): boolean {
    this.shouldReconnect = true;
    this.targetChatId = chatId;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      const rs = this.socket.readyState;
      if (
        (rs === WebSocket.OPEN || rs === WebSocket.CONNECTING) &&
        this.activeSocketChatId === chatId
      ) {
        return true;
      }
      this.socket.close();
      this.socket = null;
    }

    this.openSocket();
    return true;
  }

  private openSocket(): void {
    const chatId = this.targetChatId;
    if (chatId == null) return;

    const base = resolveWsBaseUrl();
    const path = `/ws/chat/${chatId}/`;
    const url = base ? `${base}${path}` : path;
    const socket = new WebSocket(url);
    this.socket = socket;
    this.activeSocketChatId = chatId;

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WireMessage;
        const message = toChatMessage(parsed);
        const emitChatId = this.targetChatId;
        if (!message || emitChatId == null) return;
        for (const handler of this.handlers) {
          handler({ chatId: emitChatId, message });
        }
      } catch {
        // Skip malformed ws frames to avoid breaking connection lifecycle.
      }
    };

    socket.onclose = () => {
      const closedForChatId = this.activeSocketChatId;
      if (this.socket === socket) {
        this.socket = null;
        this.activeSocketChatId = null;
      }
      if (
        this.shouldReconnect &&
        this.targetChatId != null &&
        closedForChatId != null &&
        closedForChatId === this.targetChatId
      ) {
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
        }
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (this.shouldReconnect && this.targetChatId != null) {
            this.openSocket();
          }
        }, 3_000);
      }
    };

    socket.onerror = () => {
      // Browser will call onclose afterwards, no-op here.
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.targetChatId = null;
    this.socket?.close();
    this.socket = null;
    this.activeSocketChatId = null;
  }

  isConnectedTo(chatId: number): boolean {
    return (
      this.activeSocketChatId === chatId && this.socket?.readyState === WebSocket.OPEN
    );
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
