import { http } from "./http";
import { API } from "./endpoints";

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

export async function getMainPageAds(): Promise<AdvertisementItem[]> {
  const { data } = await http.get<AdvertisementItem[]>(API.mainPageAds);
  return Array.isArray(data) ? data : [];
}
