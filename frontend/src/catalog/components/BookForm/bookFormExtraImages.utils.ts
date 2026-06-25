import type { BookExtraImage } from "../../../api/catalogApi";
import {
  deleteBookExtraImage,
  replaceBookExtraImage,
  uploadBookExtraImage,
} from "../../../api/catalogApi";
import { resolveBookCoverUrl } from "../../../shared/bookCover/resolveBookCoverUrl";

export type ExtraImage = BookExtraImage;

export type ExtraImageSlot = {
  file: File | null;
  preview: string | null;
  existing: ExtraImage | null;
  markedForDelete: boolean;
};

export const EXTRA_IMAGE_SLOT_COUNT = 5;

export const EMPTY_EXTRA_IMAGE_SLOT: ExtraImageSlot = {
  file: null,
  preview: null,
  existing: null,
  markedForDelete: false,
};

export function createEmptyExtraImageSlots(): ExtraImageSlot[] {
  return Array.from({ length: EXTRA_IMAGE_SLOT_COUNT }, () => ({ ...EMPTY_EXTRA_IMAGE_SLOT }));
}

export function buildExtraImagesFromApi(extraImages?: ExtraImage[] | null): ExtraImageSlot[] {
  const slots = createEmptyExtraImageSlots();
  if (!extraImages?.length) return slots;

  for (const img of extraImages) {
    if (img.position >= 0 && img.position < EXTRA_IMAGE_SLOT_COUNT) {
      slots[img.position] = {
        file: null,
        preview: null,
        existing: {
          ...img,
          image: resolveBookCoverUrl(img.image),
        },
        markedForDelete: false,
      };
    }
  }
  return slots;
}

export function revokeExtraImagePreviews(slots: ExtraImageSlot[]): void {
  for (const slot of slots) {
    if (slot.preview) URL.revokeObjectURL(slot.preview);
  }
}

export function slotHasVisibleImage(slot: ExtraImageSlot): boolean {
  if (slot.markedForDelete) return false;
  return Boolean(slot.preview || slot.existing?.image);
}

export function slotDisplayUrl(slot: ExtraImageSlot): string | null {
  if (slot.markedForDelete) return null;
  return slot.preview ?? slot.existing?.image ?? null;
}

export async function syncBookExtraImages(
  slug: string,
  slots: ExtraImageSlot[]
): Promise<void> {
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.markedForDelete && slot.existing) {
      await deleteBookExtraImage(slug, slot.existing.id);
    } else if (slot.file && slot.existing && !slot.markedForDelete) {
      await replaceBookExtraImage(slug, slot.existing.id, slot.file);
    } else if (slot.file && !slot.existing) {
      await uploadBookExtraImage(slug, slot.file, i);
    }
  }
}

export async function uploadNewBookExtraImages(
  slug: string,
  slots: ExtraImageSlot[]
): Promise<void> {
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.file) {
      await uploadBookExtraImage(slug, slot.file, i);
    }
  }
}
