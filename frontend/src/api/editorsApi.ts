import { http } from "./http";

const EDITORS = "/api/editors";

export interface ChapterForEdit {
  id: number;
  title: string;
  book_slug: string;
  book_title?: string;
  volume: number | null;
  volume_title?: string;
  is_paid: boolean;
  price: number;
}

function normalizeChapterForEdit(raw: Record<string, unknown>): ChapterForEdit {
  const volume = raw.volume;
  return {
    id: Number(raw.id),
    title: String(raw.title ?? ""),
    book_slug: String(raw.book_slug ?? (raw as any).bookSlug ?? ""),
    book_title: raw.book_title != null ? String(raw.book_title) : undefined,
    volume: volume != null && volume !== "" ? Number(volume) : null,
    volume_title: raw.volume_title != null ? String(raw.volume_title) : undefined,
    is_paid: raw.is_paid === true,
    price: raw.price != null ? Number(raw.price) : 1,
  };
}

export async function getChapterForEdit(chapterId: number): Promise<ChapterForEdit> {
  const { data } = await http.get<Record<string, unknown>>(
    `${EDITORS}/chapters/${chapterId}/`
  );
  return normalizeChapterForEdit(data);
}

export async function updateChapter(chapterId: number, formData: FormData): Promise<void> {
  await http.put(`${EDITORS}/chapters/${chapterId}/update/`, formData);
}
export const editorsApi = {
  getChapterForEdit,
  updateChapter,
};
