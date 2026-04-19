import { Suspense, lazy } from "react";
import type { ChapterEditorProps } from "./ChapterEditor";
import { ChapterEditorSkeleton } from "./ChapterEditorSkeleton";

const ChapterEditor = lazy(() =>
  import("./ChapterEditor").then((m) => ({ default: m.ChapterEditor }))
);

export function LazyChapterEditor(props: ChapterEditorProps) {
  return (
    <Suspense fallback={<ChapterEditorSkeleton />}>
      <ChapterEditor {...props} />
    </Suspense>
  );
}

/** Початок завантаження чанку редактора до переходу (hover / touch). */
export function prefetchChapterEditor(): void {
  void import("./ChapterEditor");
}
