import styles from "./AdvertisingBooks.module.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Container } from "../shared/Container";
import { BookAdCard } from "./BookAdCard/BookAdCard";

import coverPlaceholder from "../assets/1SR-gLCHT4s.jpg"; // заглушка обложки

import rightArrow from "../assets/backgrounds/right_arrow.svg";
import leftArrow from "../assets/backgrounds/left_arrow.svg";
import starIcon from "../assets/backgrounds/star_navigation_books.svg";
import badge18 from "../assets/backgrounds/18+.svg";

type BookAd = {
  id: string;
  title: string;
  description: string;
  coverSrc: string;
  isAdult: boolean;
};

export function AdvertisingBooks() {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);
  const [pagesCount, setPagesCount] = useState(1);

  const books: BookAd[] = useMemo(
    () => [
      {
        id: "1",
        title: "ХАОТИЧНИЙ БОГ МЕЧА",
        description:
          "Цзянь Чен – загальноВизнаний експерт, + номер один у бойових мистецтвах Цзянху. Його майстерність володіння мечем Виходила за межі досконалості і була непереможною в бою. Після битви з видатним майстром Азу Кьюбея, який зник безвісти понад сто років тому, Цзянь Чен не витримав поранень і помер…",
        coverSrc: coverPlaceholder,
        isAdult: true,
      },
      { id: "2", title: "ХАОТИЧНИЙ БОГ МЕЧА", description: "Той самий макет (поки без БД).", coverSrc: coverPlaceholder, isAdult: true },
      { id: "3", title: "ХАОТИЧНИЙ БОГ МЕЧА", description: "Той самий макет (поки без БД).", coverSrc: coverPlaceholder, isAdult: true },
      { id: "4", title: "ХАОТИЧНИЙ БОГ МЕЧА", description: "Той самий макет (поки без БД).", coverSrc: coverPlaceholder, isAdult: true },
      { id: "5", title: "ХАОТИЧНИЙ БОГ МЕЧА", description: "Той самий макет (поки без БД).", coverSrc: coverPlaceholder, isAdult: true },
    ],
    []
  );

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

  return (
    <section className={styles.section} aria-label="Реклама">
      <Container>

        {/* Заголовок с линией */}
        <div className={styles.head}>
          <div className={styles.label}>Реклама</div>
          <div className={styles.line} />
        </div>



        {/* Карусель книг */} 
        <div className={styles.carousel} ref={scrollerRef}>
          {books.map((b, idx) => (
            <div key={b.id} data-card={idx === 0 ? "1" : undefined}>
              <BookAdCard
                coverSrc={b.coverSrc}
                title={b.title}
                description={b.description}
                isAdult={b.isAdult}
                adultBadgeSrc={badge18}
                onRead={() => {
                  // позже заменишь на router navigate/to book page
                  // сейчас просто заглушка
                  console.log("READ:", b.id);
                }}
              />
            </div>
          ))}
        </div>




          {/* Навигация карусели*/}
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
