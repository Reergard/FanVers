import type { AdvertisingSlotKey } from "./advertising.types";
import type { FilterType } from "./advertising.types";
import type { ApiLocation, ApiTargetKind } from "./advertising.types";
import { SLOT_PRICE_PER_DAY, SLOT_AVAILABLE } from "./advertising.constants";

export type { FilterType } from "./advertising.types";

export type AdvertisingPlacementConfig = {
  slotKey: AdvertisingSlotKey;
  title: string;
  description: string;
  pricePerDay: number;
  available: boolean;
  filterType?: FilterType;
  filterLabel?: string;
  filterPlaceholder?: string;
};

/** Поля для API з ключа слота */
export function slotKeyToApiFields(
  slotKey: AdvertisingSlotKey
): { location: ApiLocation; target_kind: ApiTargetKind } {
  switch (slotKey) {
    case "main":
      return { location: "main", target_kind: "none" };
    case "catalog":
      return { location: "catalog", target_kind: "none" };
    case "search_general":
      return { location: "search", target_kind: "none" };
    case "search_genre":
      return { location: "search", target_kind: "genre" };
    case "search_tag":
      return { location: "search", target_kind: "tag" };
    case "search_fandom":
      return { location: "search", target_kind: "fandom" };
  }
}

export const advertisingPlacements: AdvertisingPlacementConfig[] = [
  {
    slotKey: "main",
    title: "Реклама на головній",
    pricePerDay: SLOT_PRICE_PER_DAY.main,
    available: SLOT_AVAILABLE.main,
    description:
      "Показ у рекламній каруселі на головній сторінці серед інших рекламних книг",
  },
  {
    slotKey: "catalog",
    title: "Реклама в каталозі",
    pricePerDay: SLOT_PRICE_PER_DAY.catalog,
    available: SLOT_AVAILABLE.catalog,
    description:
      "Показ у рекламній каруселі на сторінці каталогу серед інших рекламних книг",
  },
  {
    slotKey: "search_general",
    title: "Пошук — загальна реклама",
    pricePerDay: SLOT_PRICE_PER_DAY.search_general,
    available: SLOT_AVAILABLE.search_general,
    description:
      "Показ у рекламній каруселі на сторінці пошуку для всіх відвідувачів пошуку",
  },
  {
    slotKey: "search_genre",
    title: "Пошук — реклама в обраному жанрі",
    pricePerDay: SLOT_PRICE_PER_DAY.search_genre,
    available: SLOT_AVAILABLE.search_genre,
    description:
      "Показ у каруселі пошуку, коли користувач обрав цей жанр у фільтрах",
    filterType: "genre",
    filterLabel: "Жанр",
    filterPlaceholder: "Оберіть жанр",
  },
  {
    slotKey: "search_tag",
    title: "Пошук — реклама за тегом",
    pricePerDay: SLOT_PRICE_PER_DAY.search_tag,
    available: SLOT_AVAILABLE.search_tag,
    description:
      "Показ у каруселі пошуку, коли користувач обрав цей тег у фільтрах",
    filterType: "tag",
    filterLabel: "Тег",
    filterPlaceholder: "Оберіть тег",
  },
  {
    slotKey: "search_fandom",
    title: "Пошук — реклама за фендомом",
    pricePerDay: SLOT_PRICE_PER_DAY.search_fandom,
    available: SLOT_AVAILABLE.search_fandom,
    description:
      "Показ у каруселі пошуку, коли користувач обрав цей фендом у фільтрах",
    filterType: "fandom",
    filterLabel: "Фендом",
    filterPlaceholder: "Оберіть фендом",
  },
];
