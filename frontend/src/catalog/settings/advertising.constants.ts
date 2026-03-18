import type { PlacementType } from "./advertising.types";

/** Вартість за день по типу розміщення (FanCoins) */
export const PRICE_PER_DAY: Record<PlacementType, number> = {
  main: 30,
  catalog: 15,
  genres: 15,
  tags: 15,
  fandoms: 15,
};

/** Чи підтримується бекендом (genre/tag/fandom поки що в розробці) */
export const PLACEMENT_AVAILABLE: Record<PlacementType, boolean> = {
  main: true,
  catalog: true,
  genres: false,
  tags: false,
  fandoms: false,
};
