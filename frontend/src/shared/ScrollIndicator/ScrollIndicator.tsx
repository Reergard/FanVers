import { useEffect } from "react";

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/** Скролл-контейнер: .app с data-scroll-container (скролл не на window, а внутри приложения) */
function getScrollContainer(): HTMLElement | null {
  return document.querySelector("[data-scroll-container]");
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

    const update = () => {
      rafId = 0;
      const el = getScrollContainer();
      if (!el) return;

      const vh = el.clientHeight;
      const docH = el.scrollHeight;
      const scrollTop = el.scrollTop;
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

    const onResize = () => schedule();
    const onStart = () => {
      setActive();
      schedule();
    };

    const el = getScrollContainer();
    if (!el) return;

    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    el.addEventListener("wheel", onStart, { passive: true });
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("pointerdown", onStart, { passive: true });

    const vv = window.visualViewport;
    vv?.addEventListener("resize", onResize);
    vv?.addEventListener("scroll", onResize);

    const ro = "ResizeObserver" in window ? new ResizeObserver(() => schedule()) : null;
    ro?.observe(el);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).fonts?.ready?.then?.(() => schedule());

    schedule();

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      el.removeEventListener("wheel", onStart);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("pointerdown", onStart);
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


