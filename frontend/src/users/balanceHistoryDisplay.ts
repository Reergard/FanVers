import type { BalanceHistoryItem } from "./types";

const OPERATION_LABELS: Record<string, string> = {
  deposit: "Поповнення",
  withdraw: "Виведення",
  purchase: "Покупка",
  earning: "Заробіток",
  advertising: "Реклама",
  refund: "Повернення",
  thanks_given: "Подяка автору",
  thanks_received: "Подяка від читача",
};

const CREDIT_OPERATIONS = new Set([
  "deposit",
  "earning",
  "refund",
  "thanks_received",
]);

const STATUS_LABELS: Record<string, string> = {
  pending: "В обробці",
  completed: "Завершено",
  failed: "Помилка",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#f0ad4e",
  completed: "#5cb85c",
  failed: "#d9534f",
};

export function balanceOperationLabel(item: BalanceHistoryItem): string {
  if (item.description) return item.description;
  const type = item.operation_type ?? item.type ?? "";
  return OPERATION_LABELS[type] ?? type;
}

export function balanceOperationIsCredit(item: BalanceHistoryItem): boolean {
  const type = item.operation_type ?? item.type ?? "";
  return CREDIT_OPERATIONS.has(type);
}

export function formatBalanceHistoryAmount(item: BalanceHistoryItem): string {
  const num = Number(item.amount);
  if (!Number.isFinite(num)) return "—";

  const formatted = new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(num);

  const sign = balanceOperationIsCredit(item) ? "+" : "−";
  return `${sign}${formatted} FanCoins`;
}

export function formatBalanceHistoryDate(item: BalanceHistoryItem): string {
  const raw = item.created_at ?? item.date;
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw);

  return date.toLocaleString("uk-UA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function balanceHistoryStatusLabel(item: BalanceHistoryItem): string | null {
  const status = item.status;
  if (!status) return null;
  return STATUS_LABELS[status] ?? status;
}

export function balanceHistoryStatusColor(item: BalanceHistoryItem): string {
  const status = item.status ?? "";
  return STATUS_COLORS[status] ?? "rgba(255, 255, 255, 0.65)";
}
