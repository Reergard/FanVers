import { useMemo, useState } from "react";
import { BookCard } from "../BookCard/BookCard";
import { SectionLineTitle } from "../navigation/SectionLineTitle";
import type { UserTranslationBook } from "../api/catalogApi";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { useMedia } from "../shared/hooks/useMedia";
import "./MagicalGuide.css";

type GuideCard = {
  id: number;
  book: UserTranslationBook;
  description: string;
};

const FILTER_LABELS = [
  "Топ дня",
  "Топ тижня",
  "Топ місяця",
  "Залишилось топ 15",
];

const GUIDE_CARDS: GuideCard[] = [
  {
    id: 1,
    book: {
      id: 1,
      slug: "",
      title: "ХАОТИЧНИЙ БОГ МЕЧА",
      owner: 0,
      adult_content: true,
      image: null,
      created_at: null,
      last_updated: null,
      daily_income: 0,
      monthly_income: 0,
      daily_views: 0,
    },
    description:
      "Цзян Чен - здавновизначний експерт, номер один у бойових мистецтвах Цзянху.",
  },
  {
    id: 2,
    book: {
      id: 2,
      slug: "",
      title: "ХАОТИЧНИЙ БОГ МЕЧА",
      owner: 0,
      adult_content: true,
      image: null,
      created_at: null,
      last_updated: null,
      daily_income: 0,
      monthly_income: 0,
      daily_views: 0,
    },
    description: "Його майстерність володіння мечем не мала рівних серед однолітків.",
  },
  {
    id: 3,
    book: {
      id: 3,
      slug: "",
      title: "ХАОТИЧНИЙ БОГ МЕЧА",
      owner: 0,
      adult_content: true,
      image: null,
      created_at: null,
      last_updated: null,
      daily_income: 0,
      monthly_income: 0,
      daily_views: 0,
    },
    description: "Виходячи за межі досконалості, він знову стає непереможним у бою.",
  },
  {
    id: 4,
    book: {
      id: 4,
      slug: "",
      title: "ХАОТИЧНИЙ БОГ МЕЧА",
      owner: 0,
      adult_content: true,
      image: null,
      created_at: null,
      last_updated: null,
      daily_income: 0,
      monthly_income: 0,
      daily_views: 0,
    },
    description: "Кожен рух меча випереджає час, руйнуючи усталені межі сили.",
  },
  {
    id: 5,
    book: {
      id: 5,
      slug: "",
      title: "ХАОТИЧНИЙ БОГ МЕЧА",
      owner: 0,
      adult_content: true,
      image: null,
      created_at: null,
      last_updated: null,
      daily_income: 0,
      monthly_income: 0,
      daily_views: 0,
    },
    description: "Його вороги зникають ще до того, як розуміють, що бій почався.",
  },
  {
    id: 6,
    book: {
      id: 6,
      slug: "",
      title: "ХАОТИЧНИЙ БОГ МЕЧА",
      owner: 0,
      adult_content: true,
      image: null,
      created_at: null,
      last_updated: null,
      daily_income: 0,
      monthly_income: 0,
      daily_views: 0,
    },
    description: "Новий шлях сили починається там, де інші втрачають надію.",
  },
];

export function MagicalGuide2() {
  const isTablet = useMedia("(max-width: 1024px)");
  const isMobile = useMedia("(max-width: 768px)");
  const isNarrowMobile = useMedia("(max-width: 480px)");

  const cardsPerView = isNarrowMobile ? 1 : isMobile ? 2 : isTablet ? 3 : 4;
  const maxStart = Math.max(0, GUIDE_CARDS.length - cardsPerView);
  const [start, setStart] = useState(0);

  const visibleCards = useMemo(
    () => GUIDE_CARDS.slice(start, start + cardsPerView),
    [start, cardsPerView]
  );

  const onPrev = () => {
    setStart((prev) => (prev <= 0 ? maxStart : Math.max(0, prev - cardsPerView)));
  };

  const onNext = () => {
    setStart((prev) => (prev >= maxStart ? 0 : Math.min(maxStart, prev + cardsPerView)));
  };

  return (
    <section className="mg2-section" aria-label="Магічний гід">
      <SectionLineTitle text="Рекомендації" className="mg2-sectionLineTitle" />

      <div className="mg2-filters" role="tablist" aria-label="Фільтри рейтингу">
        {FILTER_LABELS.map((label) => (
          <button key={label} className="mg2-filterBtn" type="button" role="tab" aria-selected="false">
            {label}
          </button>
        ))}
      </div>

      <div className="mg2-grid">
        {visibleCards.map((item) => (
          <article key={item.id} className="mg2-cardShell">
            <BookCard book={item.book} />
            <p className="mg2-description">{item.description}</p>
            <ActionButton to="#" variant="default" size="sm" className="mg2-readBtn" ariaLabel={`Читати: ${item.book.title}`}>
              Читати
            </ActionButton>
          </article>
        ))}
      </div>

      <div className="mg2-nav">
        <button type="button" className="mg2-arrowBtn" aria-label="Попередня сторінка" onClick={onPrev}>
          <svg className="mg2-arrowIcon" viewBox="0 0 70 19" aria-hidden="true">
            <use href="/sprite-book.svg#book-carousel-arrow-left" />
          </svg>
        </button>

        <div className="mg2-indicator" aria-live="polite">
          <svg className="mg2-star" viewBox="0 0 18 18" aria-hidden="true">
            <use href="/sprite-book.svg#book-carousel-star" />
          </svg>
          <svg className="mg2-star" viewBox="0 0 18 18" aria-hidden="true">
            <use href="/sprite-book.svg#book-carousel-star" />
          </svg>
        </div>

        <button type="button" className="mg2-arrowBtn" aria-label="Наступна сторінка" onClick={onNext}>
          <svg className="mg2-arrowIcon" viewBox="0 0 70 19" aria-hidden="true" style={{ transform: "scaleX(-1)" }}>
            <use href="/sprite-book.svg#book-carousel-arrow-left" />
          </svg>
        </button>
      </div>
    </section>
  );
}

export default MagicalGuide2;
