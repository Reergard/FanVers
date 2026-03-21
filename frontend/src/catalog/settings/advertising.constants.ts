import type { AdvertisingSlotKey } from "./advertising.types";

/** Вартість за день (FanCoins) — має відповідати backend services.py */
export const SLOT_PRICE_PER_DAY: Record<AdvertisingSlotKey, number> = {
  main: 30,
  catalog: 15,
  search_general: 15,
  search_genre: 18,
  search_tag: 12,
  search_fandom: 18,
};

/** Чи доступне замовлення для слота */
export const SLOT_AVAILABLE: Record<AdvertisingSlotKey, boolean> = {
  main: true,
  catalog: true,
  search_general: true,
  search_genre: true,
  search_tag: true,
  search_fandom: true,
};
