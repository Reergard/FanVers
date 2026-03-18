import { http } from "./http";
import { API } from "./endpoints";
import type {
  PlacementType,
  CreateAdvertisementPayload,
} from "../catalog/settings/advertising.types";

export type { CreateAdvertisementPayload };

/** Книга з API реклами (book_details з AdvertisementSerializer) */
export interface AdBookDetails {
  id: number;
  slug?: string;
  title: string;
  title_en?: string | null;
  author?: string | null;
  description?: string | null;
  /** URL обкладинки з БД */
  image?: string | null;
  adult_content?: boolean;
}

/** Елемент реклами з API */
export interface AdvertisementItem {
  id: number;
  book: number;
  book_details: AdBookDetails;
  location: string;
  start_date: string;
  end_date: string;
  total_cost: number;
  is_active: boolean;
  created_at: string;
}

export const advertisingKeys = {
  all: ["advertising"] as const,
  mainPage: () => [...advertisingKeys.all, "mainPage"] as const,
  userAds: () => [...advertisingKeys.all, "userAds"] as const,
  bookAds: (bookId: number) =>
    [...advertisingKeys.all, "bookAds", bookId] as const,
};

export async function getMainPageAds(): Promise<AdvertisementItem[]> {
  const { data } = await http.get<AdvertisementItem[]>(API.mainPageAds);
  return Array.isArray(data) ? data : [];
}

/** Отримати рекламу поточного користувача */
export async function getUserAdvertisements(): Promise<AdvertisementItem[]> {
  const { data } = await http.get<AdvertisementItem[]>(API.advertisingUserAds);
  return Array.isArray(data) ? data : [];
}

/** Отримати рекламу книги (backend endpoint з фільтром). */
export async function getBookAdvertisements(
  bookId: number
): Promise<AdvertisementItem[]> {
  const { data } = await http.get<AdvertisementItem[]>(
    API.advertisingBookAds,
    { params: { book: bookId } }
  );
  return Array.isArray(data) ? data : [];
}

/** Payload для submit_order: масив items */
export interface SubmitOrderPayload {
  items: CreateAdvertisementPayload[];
}

export async function submitAdvertisingOrder(
  payload: SubmitOrderPayload
): Promise<AdvertisementItem[]> {
  const { data } = await http.post<AdvertisementItem[]>(
    API.advertisingSubmitOrder,
    payload
  );
  return Array.isArray(data) ? data : [];
}
