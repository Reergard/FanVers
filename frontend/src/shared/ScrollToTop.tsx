import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/** Скрол у верх сторінки при зміні маршруту. Використовує .app (data-scroll-container), а не window. */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-scroll-container]");
    el?.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
