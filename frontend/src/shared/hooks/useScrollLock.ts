import { useEffect, useRef } from "react";

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
  
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
  
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
  
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
  
      window.scrollTo(0, scrollY);
    };
  }, [lock]);
}
