/**
 * Типи розміщень реклами.
 * Узгоджені з Advertisement.LOCATION_CHOICES (backend models.py):
 * main, catalog, genres, tags, fandoms
 */
export type PlacementType = "main" | "catalog" | "genres" | "tags" | "fandoms";

/** Тип таргету для genre/tag/fandom */
export type FilterType = "genre" | "tag" | "fandom";

/** Стан однієї позиції в чернетці замовлення */
export type PlacementOrderState = {
  placementType: PlacementType;
  startDate: string;
  endDate: string;
  targetId: number | null;
  pricePerDay: number;
  days: number;
  totalCost: number;
  /** Чи додано в заказ (натиснуто «Додати в заказ») */
  includedInOrder: boolean;
};

/** Помилка валідації позиції */
export type PlacementValidationError = {
  placementType: PlacementType;
  message: string;
};

/**
 * Payload для створення одного розміщення.
 * target_id для genre/tag/fandom поки не підтримується бекендом —
 * модель Advertisement не має цього поля.
 */
export type CreateAdvertisementPayload = {
  book: number;
  location: PlacementType;
  start_date: string;
  end_date: string;
};
