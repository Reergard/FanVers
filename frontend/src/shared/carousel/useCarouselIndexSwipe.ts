import { useEffect, useRef, type RefObject } from "react";

const SWIPE_THRESHOLD_PX = 50;
const DRAG_CLICK_BLOCK_PX = 4;

const INTERACTIVE_SELECTOR =
  "button, a, input, textarea, select, label, [role='button']";

function isInteractiveSwipeTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest(INTERACTIVE_SELECTOR))
  );
}

/**
 * Горизонтальний свайп мишкою для index-каруселей (один слайд за раз, без scrollLeft).
 * Ліворуч → onNext, праворуч → onPrev — як у BookScrollerCarousel.
 */
export function useCarouselIndexSwipe<T extends HTMLElement>(
  onNext: () => void,
  onPrev: () => void,
  enabled = true,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const onNextRef = useRef(onNext);
  const onPrevRef = useRef(onPrev);

  onNextRef.current = onNext;
  onPrevRef.current = onPrev;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const dragState = {
      pointerId: null as number | null,
      startX: 0,
      moved: false,
    };

    const endDrag = (pointerId: number) => {
      if (dragState.pointerId !== pointerId) return;
      dragState.pointerId = null;
      el.classList.remove("carousel-index-dragging");
      try {
        el.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (isInteractiveSwipeTarget(e.target)) return;
      dragState.pointerId = e.pointerId;
      dragState.startX = e.clientX;
      dragState.moved = false;
      el.classList.add("carousel-index-dragging");
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragState.pointerId === null || e.pointerId !== dragState.pointerId) return;
      if (Math.abs(e.clientX - dragState.startX) > DRAG_CLICK_BLOCK_PX) {
        dragState.moved = true;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (dragState.pointerId === null || e.pointerId !== dragState.pointerId) return;
      const dx = e.clientX - dragState.startX;
      const wasDragging = dragState.moved;
      endDrag(e.pointerId);

      if (wasDragging && Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
        if (dx < 0) {
          onNextRef.current();
        } else {
          onPrevRef.current();
        }
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
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("click", onClickCapture, true);
      el.classList.remove("carousel-index-dragging");
    };
  }, [enabled]);

  return ref;
}
