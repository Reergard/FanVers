export type CarouselMetrics = {
  perView: number;
  gap: number;
  itemWidth: number;
  step: number;
  maxScrollLeft: number;
  pagesCount: number;
};

export function getCarouselBehavior(): ScrollBehavior {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "smooth";
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

export function getCarouselMetrics(
  el: HTMLElement,
  totalItems: number,
): CarouselMetrics {
  const computed = getComputedStyle(el);
  const perViewRaw = Number.parseInt(computed.getPropertyValue("--per-view"), 10);
  const perView = Number.isFinite(perViewRaw) && perViewRaw > 0 ? perViewRaw : 5;
  const gap = Number.parseFloat(computed.columnGap || computed.gap || "0") || 0;
  const firstItem = el.querySelector<HTMLElement>("[data-carousel-item]");
  const itemWidth = firstItem?.offsetWidth ?? 0;
  const step = itemWidth > 0 ? (itemWidth + gap) * perView : 0;
  const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
  const pagesCount = Math.max(1, Math.ceil(totalItems / perView));

  return {
    perView,
    gap,
    itemWidth,
    step,
    maxScrollLeft,
    pagesCount,
  };
}
