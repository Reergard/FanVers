import type { PlacementType } from "./advertising.types";
import type { FilterType } from "./advertising.types";
import { PRICE_PER_DAY, PLACEMENT_AVAILABLE } from "./advertising.constants";

export type { FilterType } from "./advertising.types";

export type AdvertisingPlacementConfig = {
  placementType: PlacementType;
  title: string;
  description: string;
  pricePerDay: number;
  available: boolean;
  filterType?: FilterType;
  filterLabel?: string;
  filterPlaceholder?: string;
};

export const advertisingPlacements: AdvertisingPlacementConfig[] = [
  {
    placementType: "main",
    title: "Реклама на головній",
    pricePerDay: PRICE_PER_DAY.main,
    available: PLACEMENT_AVAILABLE.main,
    description:
      "В каруселі «Реклама» на головній сторінці, максимум 1 книга на день",
  },
  {
    placementType: "catalog",
    title: "Реклама на сторінці Каталог",
    pricePerDay: PRICE_PER_DAY.catalog,
    available: PLACEMENT_AVAILABLE.catalog,
    description:
      "В каруселі «Реклама» на сторінці каталогу, максимум 1 книга на день",
  },
  {
    placementType: "genres",
    title: "Реклама у пошуку за жанрами",
    pricePerDay: PRICE_PER_DAY.genres,
    available: PLACEMENT_AVAILABLE.genres,
    description:
      "В блоці реклами при пошуку за обраним жанром, максимум 1 книга на день",
    filterType: "genre",
    filterLabel: "Жанр",
    filterPlaceholder: "Оберіть жанр",
  },
  {
    placementType: "tags",
    title: "Реклама у пошуку за тегами",
    pricePerDay: PRICE_PER_DAY.tags,
    available: PLACEMENT_AVAILABLE.tags,
    description:
      "В блоці реклами при пошуку за обраними тегами, максимум 1 книга на день",
    filterType: "tag",
    filterLabel: "Теги",
    filterPlaceholder: "Оберіть теги",
  },
  {
    placementType: "fandoms",
    title: "Реклама у пошуку за фендом",
    pricePerDay: PRICE_PER_DAY.fandoms,
    available: PLACEMENT_AVAILABLE.fandoms,
    description:
      "В блоці реклами при пошуку за обраним фендомом, максимум 1 книга на день",
    filterType: "fandom",
    filterLabel: "Фендоми",
    filterPlaceholder: "Оберіть фендом",
  },
];
