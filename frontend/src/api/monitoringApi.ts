import { http } from "./http";
import { API } from "./endpoints";

export type UpdateReadingProgressPayload = {
  reading_time: number;
  scroll_progress: number;
};

export type ChapterProgressResponse = {
  is_read: boolean;
  is_purchased: boolean;
  scroll_position: number;
  reading_time: number;
  last_read_at: string | null;
  reading_progress: number;
  book_completed?: boolean;
};

export type ReadingStatsResponse = {
  purchased_chapters: number;
  read_chapters: number;
  completed_books: number;
};

export async function updateReadingProgress(
  chapterId: number,
  payload: UpdateReadingProgressPayload,
): Promise<ChapterProgressResponse> {
  const { data } = await http.post<ChapterProgressResponse>(
    API.chapterProgress(chapterId),
    payload,
  );
  return data;
}

export async function getChapterProgress(
  chapterId: number,
): Promise<ChapterProgressResponse | null> {
  const { data } = await http.get<ChapterProgressResponse | null>(
    API.chapterProgress(chapterId),
  );
  return data;
}

export async function getUserReadingStats(): Promise<ReadingStatsResponse> {
  const { data } = await http.get<ReadingStatsResponse>(API.readingStats);
  return data;
}
