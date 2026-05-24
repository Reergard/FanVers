import { useCallback, useEffect, useRef } from "react";
import {
  getChapterProgress,
  updateReadingProgress,
} from "../../api/monitoringApi";

const DEBOUNCE_MS = 1000;
const INTERVAL_MS = 30_000;

function computeScrollProgress(): number {
  const totalHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  );
  const viewportHeight = window.innerHeight;
  const currentScroll =
    window.pageYOffset || document.documentElement.scrollTop;
  const maxScroll = Math.max(1, totalHeight - viewportHeight);
  return Math.min(100, Math.max(0, (currentScroll / maxScroll) * 100));
}

export type UseReadingProgressOptions = {
  chapterId: number | null;
  enabled: boolean;
};

export function useReadingProgress({
  chapterId,
  enabled,
}: UseReadingProgressOptions): void {
  const readingStartTimeRef = useRef<number | null>(null);
  const isReadRef = useRef(false);
  const enabledRef = useRef(enabled);
  const chapterIdRef = useRef(chapterId);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendInFlightRef = useRef(false);

  enabledRef.current = enabled;
  chapterIdRef.current = chapterId;

  const resetSession = useCallback(() => {
    readingStartTimeRef.current = Date.now();
    isReadRef.current = false;
  }, []);

  const sendProgress = useCallback((immediate = false) => {
    if (!enabledRef.current || isReadRef.current) return;
    const id = chapterIdRef.current;
    if (!id || id <= 0) return;
    if (!readingStartTimeRef.current) return;

    const doSend = async () => {
      if (!enabledRef.current || isReadRef.current) return;
      const chapterIdNow = chapterIdRef.current;
      if (!chapterIdNow || chapterIdNow <= 0) return;
      if (!readingStartTimeRef.current) return;
      if (sendInFlightRef.current) return;

      const readingTime = Math.floor(
        (Date.now() - readingStartTimeRef.current) / 1000,
      );
      const scrollProgress = computeScrollProgress();

      sendInFlightRef.current = true;
      try {
        const data = await updateReadingProgress(chapterIdNow, {
          reading_time: readingTime,
          scroll_progress: scrollProgress,
        });
        if (data.is_read) {
          isReadRef.current = true;
        }
      } catch {
        // Тихо — як у старому фронті (не заважати читанню)
      } finally {
        sendInFlightRef.current = false;
      }
    };

    if (immediate) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      void doSend();
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void doSend();
    }, DEBOUNCE_MS);
  }, []);

  const flushProgress = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    sendProgress(true);
  }, [sendProgress]);

  // Старт сесії: GET (вже прочитано?) або новий таймер + initial POST
  useEffect(() => {
    if (!enabled || !chapterId || chapterId <= 0) {
      readingStartTimeRef.current = null;
      isReadRef.current = false;
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const existing = await getChapterProgress(chapterId);
        if (cancelled) return;
        if (existing?.is_read) {
          isReadRef.current = true;
          readingStartTimeRef.current = null;
          return;
        }
      } catch {
        if (cancelled) return;
      }

      resetSession();
      sendProgress(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, chapterId, resetSession, sendProgress]);

  useEffect(() => {
    if (!enabled) return;
    const onScroll = () => sendProgress(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled, sendProgress]);

  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.hidden) flushProgress();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled, flushProgress]);

  useEffect(() => {
    if (!enabled) return;
    const intervalId = setInterval(() => {
      if (!isReadRef.current) sendProgress(true);
    }, INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [enabled, sendProgress]);

  useEffect(() => {
    return () => {
      if (enabledRef.current && !isReadRef.current) {
        flushProgress();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [flushProgress]);
}
