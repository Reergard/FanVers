import type { ChatMessage } from "../api/types";

export type CounterWsPayload = {
  chatId: number;
  message: ChatMessage | null;
  unreadCount?: number;
};

type CounterHandler = (payload: CounterWsPayload) => void;

type CounterWireMessage = {
  type?: string;
  id?: number | null;
  chat_id?: number;
  message?: string;
  sender?: { id?: number; username?: string };
  timestamp?: string;
  created_at?: string;
  unread_count?: number;
  unreadCount?: number;
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

  if (import.meta.env.DEV) return "";

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}`;
}

function parseUnreadCount(raw: CounterWireMessage): number | undefined {
  const v = raw.unread_count ?? raw.unreadCount;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function toCounterPayload(raw: CounterWireMessage): CounterWsPayload | null {
  const chatId = Number(raw.chat_id);
  if (Number.isNaN(chatId)) return null;

  const unreadCount = parseUnreadCount(raw);
  const idRaw = raw.id;
  const id = idRaw != null ? Number(idRaw) : NaN;
  const content = typeof raw.message === "string" ? raw.message : "";
  const hasMessage = !Number.isNaN(id) && content.length > 0;

  if (hasMessage) {
    return {
      chatId,
      message: {
        id,
        content,
        sender: {
          id: Number.isNaN(Number(raw.sender?.id)) ? undefined : Number(raw.sender?.id),
          username: raw.sender?.username ?? "",
        },
        created_at: raw.created_at ?? raw.timestamp ?? new Date().toISOString(),
      },
      ...(unreadCount !== undefined ? { unreadCount } : {}),
    };
  }

  if (unreadCount !== undefined) {
    return { chatId, message: null, unreadCount };
  }

  return null;
}

class CounterWsService {
  private socket: WebSocket | null = null;
  private handlers = new Set<CounterHandler>();
  private shouldReconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(): boolean {
    this.shouldReconnect = true;
    if (this.socket) {
      const rs = this.socket.readyState;
      if (rs === WebSocket.OPEN || rs === WebSocket.CONNECTING) return true;
    }
    this.openSocket();
    return true;
  }

  private openSocket(): void {
    const base = resolveWsBaseUrl();
    const path = "/ws/counter/";
    const url = base ? `${base}${path}` : path;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as CounterWireMessage;
        const payload = toCounterPayload(parsed);
        if (!payload) return;
        for (const handler of this.handlers) {
          handler(payload);
        }
      } catch {
        // Ignore malformed frame and keep connection alive.
      }
    };

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "ping" }));
    };

    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null;
      }
      if (this.shouldReconnect) {
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
        }
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (this.shouldReconnect) {
            this.openSocket();
          }
        }, 3_000);
      }
    };

    socket.onerror = () => {
      // Browser will trigger onclose after this.
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  onMessage(handler: CounterHandler): void {
    this.handlers.add(handler);
  }

  offMessage(handler: CounterHandler): void {
    this.handlers.delete(handler);
  }
}

export const counterWs = new CounterWsService();
