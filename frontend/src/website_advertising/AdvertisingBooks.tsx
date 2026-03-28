import styles from "./AdvertisingBooks.module.css";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Container } from "../shared/Container";
import { SectionLineTitle } from "../navigation/SectionLineTitle";
import { BookCard } from "../BookCard/BookCard";
import { resolveBookCoverUrl } from "../shared/bookCover/resolveBookCoverUrl";
import {
  getMainPageAds,
  advertisingKeys,
  type AdvertisementItem,
} from "../api/advertisingApi";
import rightArrow from "../assets/backgrounds/right_arrow.svg";
import leftArrow from "../assets/backgrounds/left_arrow.svg";
import starIcon from "../assets/backgrounds/star_navigation_books.svg";

/** Дані для картки реклами (передаються в BookCard variant=ad) */
type AdBookItem = {
  id: string;
  slug?: string;
  title: string;
  description: string;
  coverSrc: string;
  isAdult: boolean;
};

type CarouselMetrics = {
  perView: number;
  gap: number;
  itemWidth: number;
  step: number;
  maxScrollLeft: number;
  pagesCount: number;
};

function adsToBookItems(ads: AdvertisementItem[]): AdBookItem[] {
  return ads.map((ad) => {
    const b = ad.book_details;
    return {
      id: String(b.id),
      slug: b.slug,
      title: b.title || "Без назви",
      description: b.description || "",
      coverSrc: resolveBookCoverUrl(b.image),
      isAdult: b.adult_content === true,
    };
  });
}

function getBehavior(): ScrollBehavior {
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

function getCarouselMetrics(
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

export type AdvertisingCarouselProps = {
  /** Заголовок секції */
  title?: string;
  queryKey: readonly unknown[];
  queryFn: () => Promise<AdvertisementItem[]>;
  /** Якщо false — не рендерити зовнішній Container (для вбудовування в інший layout) */
  withContainer?: boolean;
};

/**
 * Універсальна карусель реклами: React Query + BookCard variant="ad".
 */
export function AdvertisingCarousel({
  title = "Реклама",
  queryKey,
  queryFn,
  withContainer = true,
}: AdvertisingCarouselProps) {
  const titleId = useId();
  const carouselRegionId = useId();
  const scrollerRef = useRef<HTMLUListElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [page, setPage] = useState(0);
  const [pagesCount, setPagesCount] = useState(1);

  const { data: ads = [] } = useQuery({
    queryKey,
    queryFn,
  });

  const books: AdBookItem[] = useMemo(() => adsToBookItems(ads), [ads]);

  const syncStateFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const metrics = getCarouselMetrics(el, books.length);
    setPagesCount(metrics.pagesCount);

    if (metrics.step <= 0 || metrics.maxScrollLeft <= 0) {
      setPage(0);
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
  }, [books.length]);

  const scrollToPage = useCallback(
    (targetPage: number) => {
      const el = scrollerRef.current;
      if (!el) return;

      const metrics = getCarouselMetrics(el, books.length);
      const nextPage = Math.max(
        0,
        Math.min(targetPage, Math.max(0, metrics.pagesCount - 1)),
      );

      if (metrics.step <= 0) {
        setPage(0);
        return;
      }

      const targetLeft = Math.min(metrics.maxScrollLeft, nextPage * metrics.step);
      el.scrollTo({ left: targetLeft, behavior: getBehavior() });
    },
    [books.length],
  );

  const scrollByPage = useCallback(
    (direction: -1 | 1) => {
      scrollToPage(page + direction);
    },
    [page, scrollToPage],
  );

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
    el.querySelectorAll<HTMLElement>("[data-carousel-item]").forEach((node) => {
      resizeObserver.observe(node);
    });

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
  }, [books.length, syncStateFromScroll]);

  /** Після зміни списку та наступних кадрів верстки (картинки, шрифти) — додатковий перерахунок */
  useEffect(() => {
    if (books.length === 0) return;

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
  }, [books.length, syncStateFromScroll]);

  /** Якщо кількість елементів зменшилась — не залишаємось на неіснуючій сторінці */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || books.length === 0) return;

    const metrics = getCarouselMetrics(el, books.length);
    const maxPage = Math.max(0, metrics.pagesCount - 1);

    setPage((prev) => {
      if (prev <= maxPage) return prev;
      queueMicrotask(() => {
        const node = scrollerRef.current;
        if (!node) return;
        const m = getCarouselMetrics(node, books.length);
        if (m.step > 0) {
          const targetLeft = Math.min(m.maxScrollLeft, maxPage * m.step);
          node.scrollTo({ left: targetLeft, behavior: "auto" });
        }
      });
      return maxPage;
    });
  }, [books.length]);

  if (books.length === 0) return null;

  const atStart = page <= 0;
  const atEnd = page >= pagesCount - 1;

  const inner = (
    <>
      <SectionLineTitle
        text={title}
        className={styles.sectionTitle}
        labelId={titleId}
      />

      <div className={styles.carouselWrap}>
        <ul
          ref={scrollerRef}
          id={carouselRegionId}
          className={styles.carousel}
        >
          {books.map((b) => (
            <li
              key={`${b.id}-${b.slug ?? b.title}`}
              className={styles.item}
              data-carousel-item
            >
              <BookCard
                book={{
                  id: Number(b.id),
                  slug: b.slug,
                  title: b.title,
                  image: b.coverSrc,
                  adult_content: b.isAdult,
                }}
                variant="ad"
                description={b.description}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.nav}>
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
    </>
  );

  return (
    <section
      className={styles.section}
      aria-roledescription="carousel"
      aria-labelledby={titleId}
    >
      {withContainer ? <Container>{inner}</Container> : inner}
    </section>
  );
}

/** Головна сторінка — реклама з location=main */
export function AdvertisingBooks() {
  return (
    <AdvertisingCarousel
      queryKey={advertisingKeys.mainPage()}
      queryFn={getMainPageAds}
    />
  );
}
