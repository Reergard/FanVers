import { useEffect } from "react";

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export function ScrollIndicator() {
  useEffect(() => {
    const root = document.documentElement;
    let rafId = 0;
    let activeTimer = 0;

    const MIN_THUMB_PX = 28;
    const ACTIVE_MS = 800;

    const getGapPx = () => {
      const v = getComputedStyle(root).getPropertyValue("--si-gap").trim();
      const n = Number.parseFloat(v);
      return Number.isFinite(n) ? n : 10;
    };

    const setActive = () => {
      root.classList.add("is-scrolling");
      if (activeTimer) window.clearTimeout(activeTimer);
      activeTimer = window.setTimeout(() => {
        root.classList.remove("is-scrolling");
      }, ACTIVE_MS);
    };

    const getViewportHeight = () => window.visualViewport?.height ?? window.innerHeight;

    const getDocumentHeight = () => {
      const body = document.body;
      return Math.max(root.scrollHeight, body?.scrollHeight ?? 0);
    };

    const getScrollTop = () => window.scrollY ?? root.scrollTop ?? document.body?.scrollTop ?? 0;

    const update = () => {
      rafId = 0;

      const vh = getViewportHeight();
      const docH = getDocumentHeight();
      const scrollTop = getScrollTop();
      const gap = getGapPx();

      const visible = docH > vh + 1 ? 1 : 0;
      root.style.setProperty("--si-visible", String(visible));
      if (!visible) return;

      const trackH = Math.max(0, vh - gap * 2);
      const rawThumbH = (vh / docH) * trackH;
      const thumbH = Math.max(MIN_THUMB_PX, Math.min(trackH, rawThumbH));

      const scrollMax = Math.max(1, docH - vh);
      const progress = clamp01(scrollTop / scrollMax);
      const thumbTop = progress * Math.max(0, trackH - thumbH);

      root.style.setProperty("--si-progress", progress.toFixed(6));
      root.style.setProperty("--si-thumb-height", `${thumbH.toFixed(2)}px`);
      root.style.setProperty("--si-thumb-top", `${thumbTop.toFixed(2)}px`);
    };

    const schedule = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(update);
    };

    const onScroll = () => {
      setActive();
      schedule();
    };

    const onResize = () => {
      schedule();
    };

    const onStart = () => {
      setActive();
      schedule();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("wheel", onStart, { passive: true });
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("pointerdown", onStart, { passive: true });

    const vv = window.visualViewport;
    vv?.addEventListener("resize", onResize);
    vv?.addEventListener("scroll", onResize);

    const ro =
      "ResizeObserver" in window
        ? new ResizeObserver(() => schedule())
        : null;
    ro?.observe(document.body);

    // Шрифты могут менять метрики и высоту документа после загрузки
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).fonts?.ready?.then?.(() => schedule());

    schedule();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("wheel", onStart);
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("pointerdown", onStart);
      vv?.removeEventListener("resize", onResize);
      vv?.removeEventListener("scroll", onResize);
      ro?.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
      if (activeTimer) window.clearTimeout(activeTimer);
      root.classList.remove("is-scrolling");
    };
  }, []);

  return (
    <div className="scrollIndicator" aria-hidden="true">
      <div className="scrollIndicator__track" />
      <div className="scrollIndicator__thumb" />
    </div>
  );
}


