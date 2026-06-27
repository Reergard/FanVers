import { useEffect, useRef } from "react";

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/** Метрики вертикального скролла документа (window), не внутреннего контейнера */
function getDocScrollMetrics(): {
  scrollTop: number;
  docH: number;
  vh: number;
} {
  const docEl = document.documentElement;
  const body = document.body;
  const scrollTop =
    window.scrollY ?? docEl.scrollTop ?? body?.scrollTop ?? 0;
  const docH = Math.max(docEl.scrollHeight, body?.scrollHeight ?? 0);
  const vh = window.innerHeight;
  return { scrollTop, docH, vh };
}

const MIN_THUMB_PX = 28;
const ACTIVE_MS = 800;

function getGapPx(root: HTMLElement) {
  const v = getComputedStyle(root).getPropertyValue("--si-gap").trim();
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 10;
}

function getThumbMetrics(root: HTMLElement) {
  const { scrollTop, docH, vh } = getDocScrollMetrics();
  const gap = getGapPx(root);
  const trackH = Math.max(0, vh - gap * 2);
  const rawThumbH = (vh / docH) * trackH;
  const thumbH = Math.max(MIN_THUMB_PX, Math.min(trackH, rawThumbH));
  const scrollMax = Math.max(0, docH - vh);
  const scrollRange = Math.max(1, trackH - thumbH);
  const progress = scrollMax > 0 ? clamp01(scrollTop / scrollMax) : 0;
  const thumbTop = progress * Math.max(0, trackH - thumbH);

  return {
    scrollTop,
    docH,
    vh,
    gap,
    trackH,
    thumbH,
    scrollMax,
    scrollRange,
    progress,
    thumbTop,
    visible: docH > vh + 1,
  };
}

export function ScrollIndicator() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const indicatorEl = rootRef.current;
    const trackEl = trackRef.current;
    const thumbEl = thumbRef.current;
    if (!indicatorEl || !trackEl || !thumbEl) return;

    let rafId = 0;
    let activeTimer = 0;
    let dragPointerId: number | null = null;
    let dragStartY = 0;
    let dragStartScrollTop = 0;

    const setActive = () => {
      root.classList.add("is-scrolling");
      if (activeTimer) window.clearTimeout(activeTimer);
      activeTimer = window.setTimeout(() => {
        root.classList.remove("is-scrolling");
      }, ACTIVE_MS);
    };

    const update = () => {
      rafId = 0;
      const metrics = getThumbMetrics(root);
      const visible = metrics.visible ? 1 : 0;

      root.style.setProperty("--si-visible", String(visible));
      indicatorEl.dataset.visible = visible ? "1" : "0";

      if (!metrics.visible) return;

      root.style.setProperty("--si-progress", metrics.progress.toFixed(6));
      root.style.setProperty("--si-thumb-height", `${metrics.thumbH.toFixed(2)}px`);
      root.style.setProperty("--si-thumb-top", `${metrics.thumbTop.toFixed(2)}px`);
    };

    const schedule = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(update);
    };

    const scrollToProgress = (progress: number) => {
      const { scrollMax } = getThumbMetrics(root);
      window.scrollTo({ top: clamp01(progress) * scrollMax, behavior: "auto" });
      setActive();
      schedule();
    };

    const onScroll = () => {
      setActive();
      schedule();
    };

    const onResize = () => schedule();

    const onStart = () => {
      setActive();
      schedule();
    };

    const endDrag = () => {
      dragPointerId = null;
      document.documentElement.classList.remove("is-scrollbar-dragging");
    };

    const onThumbPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0) return;
      if (indicatorEl.dataset.visible !== "1") return;

      e.preventDefault();
      dragPointerId = e.pointerId;
      dragStartY = e.clientY;
      dragStartScrollTop = window.scrollY;
      thumbEl.setPointerCapture(e.pointerId);
      document.documentElement.classList.add("is-scrollbar-dragging");
      setActive();
    };

    const onThumbPointerMove = (e: PointerEvent) => {
      if (dragPointerId !== e.pointerId) return;

      e.preventDefault();
      const metrics = getThumbMetrics(root);
      if (metrics.scrollMax <= 0) return;

      const deltaY = e.clientY - dragStartY;
      const scrollPerPx = metrics.scrollMax / metrics.scrollRange;
      window.scrollTo({
        top: dragStartScrollTop + deltaY * scrollPerPx,
        behavior: "auto",
      });
      schedule();
    };

    const onThumbPointerUp = (e: PointerEvent) => {
      if (dragPointerId !== e.pointerId) return;
      if (thumbEl.hasPointerCapture(e.pointerId)) {
        thumbEl.releasePointerCapture(e.pointerId);
      }
      endDrag();
    };

    const onTrackPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0) return;
      if (e.target !== trackEl) return;
      if (indicatorEl.dataset.visible !== "1") return;

      e.preventDefault();
      const rect = trackEl.getBoundingClientRect();
      const metrics = getThumbMetrics(root);
      const clickY = e.clientY - rect.top;
      const targetThumbTop = clickY - metrics.thumbH / 2;
      const progress = targetThumbTop / metrics.scrollRange;
      scrollToProgress(progress);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("wheel", onStart, { passive: true });
    window.addEventListener("touchstart", onStart, { passive: true });

    thumbEl.addEventListener("pointerdown", onThumbPointerDown);
    thumbEl.addEventListener("pointermove", onThumbPointerMove);
    thumbEl.addEventListener("pointerup", onThumbPointerUp);
    thumbEl.addEventListener("pointercancel", onThumbPointerUp);
    thumbEl.addEventListener("lostpointercapture", endDrag);

    trackEl.addEventListener("pointerdown", onTrackPointerDown);

    const vv = window.visualViewport;
    vv?.addEventListener("resize", onResize);
    vv?.addEventListener("scroll", onResize);

    const ro =
      "ResizeObserver" in window
        ? new ResizeObserver(() => schedule())
        : null;
    ro?.observe(document.documentElement);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).fonts?.ready?.then?.(() => schedule());

    schedule();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("wheel", onStart);
      window.removeEventListener("touchstart", onStart);
      thumbEl.removeEventListener("pointerdown", onThumbPointerDown);
      thumbEl.removeEventListener("pointermove", onThumbPointerMove);
      thumbEl.removeEventListener("pointerup", onThumbPointerUp);
      thumbEl.removeEventListener("pointercancel", onThumbPointerUp);
      thumbEl.removeEventListener("lostpointercapture", endDrag);
      trackEl.removeEventListener("pointerdown", onTrackPointerDown);
      vv?.removeEventListener("resize", onResize);
      vv?.removeEventListener("scroll", onResize);
      ro?.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
      if (activeTimer) window.clearTimeout(activeTimer);
      root.classList.remove("is-scrolling");
      document.documentElement.classList.remove("is-scrollbar-dragging");
    };
  }, []);

  return (
    <div ref={rootRef} className="scrollIndicator" data-visible="0" aria-hidden="true">
      <div ref={trackRef} className="scrollIndicator__track" />
      <div ref={thumbRef} className="scrollIndicator__thumb" />
    </div>
  );
}
