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
  const pagesFromItems = Math.max(1, Math.ceil(totalItems / perView));
  const pagesFromScroll =
    maxScrollLeft > 0 && step > 0
      ? Math.max(2, Math.floor(maxScrollLeft / step) + 1)
      : 1;
  const pagesCount =
    maxScrollLeft <= 0 ? 1 : Math.max(pagesFromItems, pagesFromScroll);

  return {
    perView,
    gap,
    itemWidth,
    step,
    maxScrollLeft,
    pagesCount,
  };
}

/** Допуск для «початку» / «кінця» (snap, subpixel, коротка остання сторінка). */
export function getCarouselScrollThreshold(metrics: CarouselMetrics): number {
  const itemStep = metrics.itemWidth > 0 ? metrics.itemWidth + metrics.gap : metrics.gap;
  return Math.max(20, Math.round(itemStep * 0.4));
}

export function isCarouselAtStart(
  metrics: CarouselMetrics,
  scrollLeft: number,
): boolean {
  const safeLeft = Math.min(metrics.maxScrollLeft, Math.max(0, scrollLeft));
  return safeLeft <= getCarouselScrollThreshold(metrics);
}

export function isCarouselAtEnd(
  metrics: CarouselMetrics,
  scrollLeft: number,
): boolean {
  if (metrics.maxScrollLeft <= 0) return true;
  const safeLeft = Math.min(metrics.maxScrollLeft, Math.max(0, scrollLeft));
  return safeLeft >= metrics.maxScrollLeft - getCarouselScrollThreshold(metrics);
}

/** Поточна сторінка з позиції scrollLeft. */
export function getCarouselPage(
  metrics: CarouselMetrics,
  scrollLeft: number,
): number {
  const maxPage = Math.max(0, metrics.pagesCount - 1);
  if (maxPage === 0 || metrics.maxScrollLeft <= 0) return 0;

  if (isCarouselAtEnd(metrics, scrollLeft)) return maxPage;
  if (isCarouselAtStart(metrics, scrollLeft)) return 0;

  if (metrics.step <= 0) return 0;

  return Math.max(
    0,
    Math.min(maxPage, Math.round(scrollLeft / metrics.step)),
  );
}

/** Цільовий scrollLeft для сторінки (остання — maxScrollLeft, не step * page). */
export function getCarouselPageScrollLeft(
  metrics: CarouselMetrics,
  page: number,
): number {
  const maxPage = Math.max(0, metrics.pagesCount - 1);
  const clampedPage = Math.max(0, Math.min(page, maxPage));
  if (metrics.maxScrollLeft <= 0) return 0;
  if (clampedPage >= maxPage) return metrics.maxScrollLeft;
  if (metrics.step <= 0) return 0;
  return Math.min(metrics.maxScrollLeft, clampedPage * metrics.step);
}

/**
 * Наступна позиція для автопрокрутки.
 * Для 6 книг / 5 на екрані: чергує 0 ↔ maxScrollLeft (коротка остання сторінка).
 */
export function getCarouselNextAutoScrollLeft(
  metrics: CarouselMetrics,
  scrollLeft: number,
): number {
  if (metrics.maxScrollLeft <= 0) return 0;

  const maxPage = Math.max(0, metrics.pagesCount - 1);
  if (maxPage === 0) return 0;

  const shortLastPage =
    metrics.step <= 0 ||
    metrics.maxScrollLeft < metrics.step - getCarouselScrollThreshold(metrics);

  if (shortLastPage || maxPage === 1) {
    return isCarouselAtEnd(metrics, scrollLeft) ? 0 : metrics.maxScrollLeft;
  }

  const current = getCarouselPage(metrics, scrollLeft);
  const nextPage = current >= maxPage ? 0 : current + 1;
  return getCarouselPageScrollLeft(metrics, nextPage);
}
