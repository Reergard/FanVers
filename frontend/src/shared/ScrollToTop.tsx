import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/** Скрол у верх сторінки при зміні маршруту. */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
