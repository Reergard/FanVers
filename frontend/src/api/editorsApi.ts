import { isAxiosError } from "axios";
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

export interface ChapterContentResponse {
  content_json: Record<string, unknown>;
  content_version: number;
}

export interface SaveContentResponse {
  status: string;
  content_version: number;
  characters_count: number;
}

export async function getChapterContent(chapterId: number): Promise<ChapterContentResponse> {
  const { data } = await http.get<ChapterContentResponse>(
    `${EDITORS}/chapters/${chapterId}/content/`
  );
  return data;
}

export async function saveChapterContent(
  chapterId: number,
  contentJson: Record<string, unknown>,
  options?: { expectedVersion?: number | null }
): Promise<SaveContentResponse> {
  const body: Record<string, unknown> = { content: contentJson };
  if (options?.expectedVersion != null) {
    body.expected_version = options.expectedVersion;
  }
  try {
    const { data } = await http.put<SaveContentResponse>(
      `${EDITORS}/chapters/${chapterId}/content/save/`,
      body
    );
    return data;
  } catch (e: unknown) {
    if (isAxiosError(e) && e.response?.status === 409) {
      const d = e.response.data as { server_version?: number; detail?: string };
      const err = new Error("content_version_conflict") as Error & {
        serverVersion?: number;
        detail?: string;
      };
      err.serverVersion = d?.server_version;
      err.detail = d?.detail;
      throw err;
    }
    throw e;
  }
}

export async function uploadEditorImage(
  chapterId: number,
  file: File
): Promise<{ url: string }> {
  const form = new FormData();
  form.append("image", file);
  const { data } = await http.post<{ url: string }>(
    `${EDITORS}/chapters/${chapterId}/upload-image/`,
    form
  );
  return data;
}

export async function uploadTempImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("image", file);
  const { data } = await http.post<{ url: string }>(`${EDITORS}/upload-temp-image/`, form);
  return data;
}

export const editorsApi = {
  getChapterForEdit,
  updateChapter,
  getChapterContent,
  saveChapterContent,
  uploadEditorImage,
  uploadTempImage,
};
