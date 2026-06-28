import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import rightArrow from "../../assets/backgrounds/right_arrow.svg";
import leftArrow from "../../assets/backgrounds/left_arrow.svg";
import starIcon from "../../assets/backgrounds/star_navigation_books.svg";
import { getCarouselBehavior, getCarouselMetrics } from "./carouselUtils";
import styles from "./BookScrollerCarousel.module.css";

export type BookScrollerCarouselProps = {
  itemCount: number;
  children: ReactNode;
  carouselClassName?: string;
  wrapClassName?: string;
  navClassName?: string;
  showNav?: boolean;
};

/**
 * Горизонтальна карусель зі стрілками та зірками-пагінацією.
 * Використовується на головній (реклама), сторінці книги (інші роботи автора) тощо.
 */
export function BookScrollerCarousel({
  itemCount,
  children,
  carouselClassName,
  wrapClassName,
  navClassName,
  showNav = true,
}: BookScrollerCarouselProps) {
  const carouselRegionId = useId();
  const scrollerRef = useRef<HTMLUListElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const syncStateFromScrollRef = useRef<() => void>(() => {});
  const [page, setPage] = useState(0);
  const [pagesCount, setPagesCount] = useState(1);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const syncStateFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const metrics = getCarouselMetrics(el, itemCount);
    setPagesCount(metrics.pagesCount);

    if (metrics.step <= 0 || metrics.maxScrollLeft <= 0) {
      setPage(0);
      setAtStart(true);
      setAtEnd(true);
      return;
    }

    const safeLeft = Math.min(
      metrics.maxScrollLeft,
      Math.max(0, el.scrollLeft),
    );
    const nextPage = Math.round(safeLeft / metrics.step);
    setPage(
      Math.max(0, Math.min(nextPage, Math.max(0, metrics.pagesCount - 1))),
    );
    setAtStart(safeLeft <= 2);
    setAtEnd(safeLeft >= metrics.maxScrollLeft - 2);
  }, [itemCount]);

  syncStateFromScrollRef.current = syncStateFromScroll;

  const scrollToPage = useCallback(
    (targetPage: number) => {
      const el = scrollerRef.current;
      if (!el) return;

      const metrics = getCarouselMetrics(el, itemCount);
      const nextPage = Math.max(
        0,
        Math.min(targetPage, Math.max(0, metrics.pagesCount - 1)),
      );

      if (metrics.step <= 0) {
        setPage(0);
        return;
      }

      const targetLeft = Math.min(metrics.maxScrollLeft, nextPage * metrics.step);
      el.scrollTo({ left: targetLeft, behavior: getCarouselBehavior() });
    },
    [itemCount],
  );

  const scrollByPage = useCallback(
    (direction: -1 | 1) => {
      scrollToPage(page + direction);
    },
    [page, scrollToPage],
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || itemCount === 0) return;

    const dragState = {
      pointerId: null as number | null,
      startX: 0,
      scrollLeft: 0,
      moved: false,
    };

    const endDrag = (pointerId: number) => {
      if (dragState.pointerId !== pointerId) return;
      dragState.pointerId = null;
      el.classList.remove(styles.dragging);
      try {
        el.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      e.preventDefault();
      dragState.pointerId = e.pointerId;
      dragState.startX = e.clientX;
      dragState.scrollLeft = el.scrollLeft;
      dragState.moved = false;
      el.classList.add(styles.dragging);
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragState.pointerId === null || e.pointerId !== dragState.pointerId) return;
      const dx = e.clientX - dragState.startX;
      if (Math.abs(dx) > 4) {
        dragState.moved = true;
        e.preventDefault();
      }
      el.scrollLeft = dragState.scrollLeft - dx;
      syncStateFromScrollRef.current();
    };

    const onDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    const onPointerUp = (e: PointerEvent) => {
      const wasDragging = dragState.moved;
      endDrag(e.pointerId);
      if (wasDragging) {
        syncStateFromScrollRef.current();
      }
    };

    const onClickCapture = (e: MouseEvent) => {
      if (!dragState.moved) return;
      e.preventDefault();
      e.stopPropagation();
      dragState.moved = false;
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("dragstart", onDragStart, true);
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("dragstart", onDragStart, true);
      el.removeEventListener("click", onClickCapture, true);
      el.classList.remove(styles.dragging);
    };
  }, [itemCount]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const scheduleSync = () => {
      if (rafRef.current !== null) return;

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        syncStateFromScroll();
      });
    };

    syncStateFromScroll();

    const resizeObserver = new ResizeObserver(() => {
      scheduleSync();
    });

    resizeObserver.observe(el);

    const onWindowResize = () => {
      scheduleSync();
    };

    el.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", onWindowResize, { passive: true });

    return () => {
      resizeObserver.disconnect();
      el.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", onWindowResize);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [itemCount, syncStateFromScroll]);

  useEffect(() => {
    if (itemCount === 0) return;

    let innerRaf: number | null = null;
    const outerRaf = window.requestAnimationFrame(() => {
      innerRaf = window.requestAnimationFrame(() => {
        innerRaf = null;
        syncStateFromScroll();
      });
    });

    return () => {
      window.cancelAnimationFrame(outerRaf);
      if (innerRaf !== null) {
        window.cancelAnimationFrame(innerRaf);
      }
    };
  }, [itemCount, syncStateFromScroll]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || itemCount === 0) return;

    const metrics = getCarouselMetrics(el, itemCount);
    const maxPage = Math.max(0, metrics.pagesCount - 1);

    setPage((prev) => {
      if (prev <= maxPage) return prev;
      queueMicrotask(() => {
        const node = scrollerRef.current;
        if (!node) return;
        const m = getCarouselMetrics(node, itemCount);
        if (m.step > 0) {
          const targetLeft = Math.min(m.maxScrollLeft, maxPage * m.step);
          node.scrollTo({ left: targetLeft, behavior: "auto" });
        }
      });
      return maxPage;
    });
  }, [itemCount]);

  const showNavigation = showNav && pagesCount > 1;
  /** 1–2 книги на одній «сторінці» — по центру; більше — як раніше зліва */
  const centerItems = itemCount > 0 && itemCount <= 2 && pagesCount === 1;

  return (
    <>
      <div className={[styles.carouselWrap, wrapClassName].filter(Boolean).join(" ")}>
        <ul
          ref={scrollerRef}
          id={carouselRegionId}
          className={[
            styles.carousel,
            centerItems ? styles.carouselFew : "",
            carouselClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </ul>
      </div>

      {showNavigation && (
        <div className={[styles.nav, navClassName].filter(Boolean).join(" ")}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => scrollByPage(-1)}
            aria-label="Назад"
            aria-controls={carouselRegionId}
            disabled={atStart}
          >
            <img src={leftArrow} alt="" aria-hidden />
          </button>

          <div className={styles.stars} aria-label="Сторінки каруселі">
            {Array.from({ length: pagesCount }).map((_, i) => {
              const isActive = i === page;

              return (
                <button
                  key={i}
                  type="button"
                  className={[
                    styles.starDot,
                    isActive ? styles.starDotActive : "",
                  ].join(" ")}
                  onClick={() => scrollToPage(i)}
                  aria-label={`Сторінка ${i + 1} з ${pagesCount}`}
                  aria-controls={carouselRegionId}
                  aria-current={isActive ? "page" : undefined}
                >
                  <img src={starIcon} alt="" aria-hidden />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className={styles.navBtn}
            onClick={() => scrollByPage(1)}
            aria-label="Вперед"
            aria-controls={carouselRegionId}
            disabled={atEnd}
          >
            <img src={rightArrow} alt="" aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}

export function BookScrollerCarouselItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <li
      className={[styles.item, className].filter(Boolean).join(" ")}
      data-carousel-item
    >
      {children}
    </li>
  );
}
