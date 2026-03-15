import styles from "./AdvertisingBooks.module.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Container } from "../shared/Container";
import { BookCard } from "../BookCard/BookCard";
import { resolveBookCoverUrl } from "../shared/bookCover/resolveBookCoverUrl";
import { getMainPageAds } from "../api/advertisingApi";
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

export function AdvertisingBooks() {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);
  const [pagesCount, setPagesCount] = useState(1);

  const { data: ads = [] } = useQuery({
    queryKey: ["main-page-ads"],
    queryFn: getMainPageAds,
  });

  const books: AdBookItem[] = useMemo(() => {
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
  }, [ads]);

  const getPerView = () => {
    const el = scrollerRef.current;
    if (!el) return 5;
    const cs = getComputedStyle(el);
    const pv = parseInt(cs.getPropertyValue("--per-view"), 10);
    return Number.isFinite(pv) && pv > 0 ? pv : 5;
  };

  const scrollByPage = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;

    const perView = getPerView();
    const cardWrap = el.querySelector<HTMLElement>(`[data-card="1"]`);

    const cs = getComputedStyle(el);
    const gap = parseFloat(cs.gap || cs.columnGap || "0") || 0;

    const cardW = cardWrap ? cardWrap.offsetWidth : 0;
    const step = (cardW + gap) * perView;

    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const recalc = () => {
      const perView = getPerView();
      const total = books.length;
      const count = Math.max(1, Math.ceil(total / perView));
      setPagesCount(count);

      // Синхронизируем page с реальным scrollLeft после ресайза
      const cardWrap = el.querySelector<HTMLElement>(`[data-card="1"]`);
      const cs = getComputedStyle(el);
      const gap = parseFloat(cs.gap || cs.columnGap || "0") || 0;
      const cardW = cardWrap ? cardWrap.offsetWidth : 0;
      const step = (cardW + gap) * perView;
      
      if (step > 0) {
        const p = Math.floor((el.scrollLeft + step * 0.5) / step);
        setPage(Math.max(0, Math.min(p, count - 1)));
      } else {
        // Если step еще не готов, просто нормализуем
        setPage((p) => Math.min(p, count - 1));
      }
    };

    const onScroll = () => {
      const perView = getPerView();
      const cardWrap = el.querySelector<HTMLElement>(`[data-card="1"]`);
      const cs = getComputedStyle(el);
      const gap = parseFloat(cs.gap || cs.columnGap || "0") || 0;

      const cardW = cardWrap ? cardWrap.offsetWidth : 0;
      const step = (cardW + gap) * perView;
      if (!step) return;

      // Пересчитываем pagesCount для корректного ограничения
      const total = books.length;
      const count = Math.max(1, Math.ceil(total / perView));
      
      // Более стабильный расчет страницы, меньше "дребезга"
      const p = Math.floor((el.scrollLeft + step * 0.5) / step);
      setPage(Math.max(0, Math.min(p, count - 1)));
    };

    recalc();
    onScroll();

    const ro = new ResizeObserver(recalc);
    ro.observe(el);

    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, [books.length]);

  if (books.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Реклама">
      <Container>

        {/* Заголовок с линией */}
        <div className={styles.head}>
          <div className={styles.label}>Реклама</div>
          <div className={styles.line} />
        </div>



        {/* Карусель книг (з БД). carouselWrap — на мобільному виходить за padding Container на 100% ширини екрана */}
        <div className={styles.carouselWrap}>
          <div className={styles.carousel} ref={scrollerRef}>
          {books.map((b, idx) => (
            <div key={b.id} data-card={idx === 0 ? "1" : undefined}>
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
            </div>
          ))}
          </div>
        </div>

        {/* Навигация карусели */}
        <div className={styles.nav}>
          <button 
            className={styles.navBtn} 
            onClick={() => scrollByPage(-1)} 
            aria-label="Назад"
            disabled={page === 0}
          >
            <img src={leftArrow} alt="" />
          </button>

          <div className={styles.stars} aria-label="Сторінки каруселі">
            {Array.from({ length: pagesCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                className={[styles.starDot, i === page ? styles.starDotActive : ""].join(" ")}
                onClick={() => {
                  const el = scrollerRef.current;
                  if (!el) return;

                  const perView = getPerView();
                  const cardWrap = el.querySelector<HTMLElement>(`[data-card="1"]`);
                  const cs = getComputedStyle(el);
                  const gap = parseFloat(cs.gap || cs.columnGap || "0") || 0;

                  const cardW = cardWrap ? cardWrap.offsetWidth : 0;
                  const step = (cardW + gap) * perView;

                  el.scrollTo({ left: i * step, behavior: "smooth" });
                }}
                aria-label={`Сторінка ${i + 1} з ${pagesCount}`}
              >
                <img src={starIcon} alt="" />
              </button>
            ))}
          </div>

          <button 
            className={styles.navBtn} 
            onClick={() => scrollByPage(1)} 
            aria-label="Вперед"
            disabled={page >= pagesCount - 1}
          >
            <img src={rightArrow} alt="" />
          </button>
        </div>
      </Container>
    </section>
  );
}
