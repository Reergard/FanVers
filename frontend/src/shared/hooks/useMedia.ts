import { useState, useEffect } from "react";

/**
 * Хук для отслеживания медиа-запросов
 * @param query - CSS медиа-запрос (например, "(max-width: 1279px)")
 * @returns boolean - соответствует ли текущий экран запросу
 */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(query);
    
    // Устанавливаем начальное значение
    setMatches(mediaQuery.matches);

    // Обработчик изменений
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Современный API
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      // Fallback для старых браузеров
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [query]);

  return matches;
}
