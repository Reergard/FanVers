import { useEffect } from "react";

/**
 * Хук для блокировки скролла body (iOS-safe)
 * Сохраняет позицию скролла и восстанавливает её при разблокировке
 * @param lock - нужно ли заблокировать скролл
 */
export function useScrollLock(lock: boolean): void {

  useEffect(() => {
    if (!lock) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;

    const prevBody = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
    };
    const prevHtml = {
      overflow: html.style.overflow,
      overscrollBehavior: html.style.overscrollBehavior,
    };

    /* iOS Safari: lock html + prevent overscroll bounce */
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = prevBody.position;
      body.style.top = prevBody.top;
      body.style.left = prevBody.left;
      body.style.right = prevBody.right;
      body.style.width = prevBody.width;
      body.style.overflow = prevBody.overflow;
      body.style.overscrollBehavior = prevBody.overscrollBehavior ?? "";
      html.style.overflow = prevHtml.overflow;
      html.style.overscrollBehavior = prevHtml.overscrollBehavior ?? "";

      window.scrollTo(0, scrollY);
    };
  }, [lock]);
}
  