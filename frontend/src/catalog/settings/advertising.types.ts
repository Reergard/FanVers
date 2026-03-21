/**
 * Ключ рядка замовлення в UI (узгоджено з advertising.data).
 */
export type AdvertisingSlotKey =
  | "main"
  | "catalog"
  | "search_general"
  | "search_genre"
  | "search_tag"
  | "search_fandom";

/** Місце показу в API */
export type ApiLocation = "main" | "catalog" | "search";

/** Таргетинг для API */
export type ApiTargetKind = "none" | "genre" | "tag" | "fandom";

/** Тип таргету для селекта в UI */
export type FilterType = "genre" | "tag" | "fandom";

/** Стан однієї позиції в чернетці замовлення */
export type PlacementOrderState = {
  slotKey: AdvertisingSlotKey;
  startDate: string;
  endDate: string;
  targetId: number | null;
  pricePerDay: number;
  days: number;
  totalCost: number;
  includedInOrder: boolean;
};

/** Payload одного слота для submit_order */
export type CreateAdvertisementPayload = {
  book: number;
  location: ApiLocation;
  target_kind: ApiTargetKind;
  target_id: number | null;
  start_date: string;
  end_date: string;
};
