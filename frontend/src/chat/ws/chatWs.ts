import type { ChatMessage } from "../api/types";
import { authStatus } from "../../auth/service";
import { isUnrecoverableSessionHttpError } from "../../shared/utils/errorUtils";

type Handler = (payload: { chatId: number; message: ChatMessage }) => void;

export type ChatWsConnectionStatus = "disconnected" | "connected" | "reconnecting";

type WireMessage = {
  type?: string;
  id?: number;
  message?: string;
  sender?: { id?: number; username?: string };
  timestamp?: string;
  created_at?: string;
};

/** Сервер закриває сокет після logout (див. LogoutView + force.disconnect). Не реконектити. */
export const WS_SESSION_ENDED_CODE = 4401;

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
  private retryCount = 0;
  private reconnectingIndicatorTimer: ReturnType<typeof setTimeout> | null = null;
  private statusHandlers = new Set<(s: ChatWsConnectionStatus) => void>();
  private lastStatus: ChatWsConnectionStatus = "disconnected";

  subscribeConnectionStatus(cb: (s: ChatWsConnectionStatus) => void): () => void {
    this.statusHandlers.add(cb);
    cb(this.lastStatus);
    return () => this.statusHandlers.delete(cb);
  }

  private notifyStatus(s: ChatWsConnectionStatus): void {
    if (this.lastStatus === s) return;
    this.lastStatus = s;
    for (const h of this.statusHandlers) {
      h(s);
    }
  }

  private clearReconnectingIndicator(): void {
    if (this.reconnectingIndicatorTimer) {
      clearTimeout(this.reconnectingIndicatorTimer);
      this.reconnectingIndicatorTimer = null;
    }
  }

  /** Індикатор «reconnecting» лише після 2–3 с, щоб не миготіти на коротких обривах. */
  private scheduleReconnectingIndicator(): void {
    this.clearReconnectingIndicator();
    this.reconnectingIndicatorTimer = setTimeout(() => {
      this.reconnectingIndicatorTimer = null;
      if (
        this.shouldReconnect &&
        (!this.socket || this.socket.readyState !== WebSocket.OPEN)
      ) {
        this.notifyStatus("reconnecting");
      }
    }, 2500);
  }

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

    socket.onopen = () => {
      this.clearReconnectingIndicator();
      this.retryCount = 0;
      this.notifyStatus("connected");
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WireMessage;
        if (parsed.type === "chat_deleted") {
          this.shouldReconnect = false;
          this.disconnect();
          return;
        }
        const message = toChatMessage(parsed);
        const emitChatId = this.targetChatId;
        if (!message || emitChatId == null) return;
        for (const handler of this.handlers) {
          handler({ chatId: emitChatId, message });
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn("[chatWs] malformed frame", err, event.data);
        }
      }
    };

    socket.onclose = (event) => {
      if (event.code === WS_SESSION_ENDED_CODE) {
        this.shouldReconnect = false;
      }
      const closedForChatId = this.activeSocketChatId;
      if (this.socket === socket) {
        this.socket = null;
        this.activeSocketChatId = null;
      }
      const willReconnect =
        this.shouldReconnect &&
        this.targetChatId != null &&
        closedForChatId != null &&
        closedForChatId === this.targetChatId;

      if (willReconnect) {
        this.scheduleReconnectingIndicator();
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
        }
        const baseDelay = Math.min(1000 * 2 ** this.retryCount, 60_000);
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;
        this.retryCount += 1;
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (!this.shouldReconnect || this.targetChatId == null) {
            this.clearReconnectingIndicator();
            this.notifyStatus("disconnected");
            return;
          }
          void (async () => {
            try {
              await authStatus();
            } catch (e) {
              if (isUnrecoverableSessionHttpError(e)) {
                this.shouldReconnect = false;
                this.clearReconnectingIndicator();
                this.notifyStatus("disconnected");
                return;
              }
            }
            if (this.shouldReconnect && this.targetChatId != null) {
              this.openSocket();
            }
          })();
        }, delay);
      } else {
        this.clearReconnectingIndicator();
        this.notifyStatus("disconnected");
      }
    };

    socket.onerror = () => {
      // Browser will call onclose afterwards, no-op here.
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectingIndicator();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.targetChatId = null;
    this.socket?.close();
    this.socket = null;
    this.activeSocketChatId = null;
    this.notifyStatus("disconnected");
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
