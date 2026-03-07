import type { ChatMessage } from "../api/types";

type CounterHandler = (payload: { chatId: number; message: ChatMessage }) => void;

type CounterWireMessage = {
  type?: string;
  id?: number;
  chat_id?: number;
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

  if (import.meta.env.DEV) return "";

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}`;
}

function toCounterPayload(raw: CounterWireMessage): { chatId: number; message: ChatMessage } | null {
  const chatId = Number(raw.chat_id);
  const id = Number(raw.id);
  const content = typeof raw.message === "string" ? raw.message : "";
  if (Number.isNaN(chatId) || Number.isNaN(id) || !content) return null;

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
  };
}

class CounterWsService {
  private socket: WebSocket | null = null;
  private handlers = new Set<CounterHandler>();

  connect(): boolean {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return true;

    this.disconnect();

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
    };

    socket.onerror = () => {
      // Browser will trigger close, nothing else needed.
    };

    return true;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
    }
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
