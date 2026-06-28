import styles from "./AdvertisingBooks.module.css";
import { useMemo } from "react";
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
import { resolveIsNewBadge } from "../shared/bookNewBadge";
import {
  BookScrollerCarousel,
  BookScrollerCarouselItem,
} from "../shared/carousel/BookScrollerCarousel";

/** Інтервал автопрокрутки рекламної каруселі (5 с) */
const ADVERTISING_CAROUSEL_AUTO_ADVANCE_MS = 5000;
/** Після наведення: якщо миша не рухається 15 с — автопрокрутка знову вмикається */
const ADVERTISING_CAROUSEL_HOVER_IDLE_MS = 15000;

/** Дані для картки реклами (передаються в BookCard variant=ad) */
type AdBookItem = {
  id: string;
  slug?: string;
  title: string;
  description: string;
  coverSrc: string;
  isAdult: boolean;
  book_type: string | null;
  is_new_badge: boolean;
  created_at: string | null;
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
      book_type: b.book_type ?? null,
      is_new_badge: resolveIsNewBadge(
        b.is_new_badge,
        b.created_at != null && b.created_at !== "" ? String(b.created_at) : null,
      ),
      created_at:
        b.created_at != null && b.created_at !== "" ? String(b.created_at) : null,
    };
  });
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
  const { data: ads = [] } = useQuery({
    queryKey,
    queryFn,
  });

  const books: AdBookItem[] = useMemo(() => adsToBookItems(ads), [ads]);

  if (books.length === 0) return null;

  const inner = (
    <>
      <SectionLineTitle
        text={title}
        className={styles.sectionTitle}
      />

      <BookScrollerCarousel
        itemCount={books.length}
        autoAdvanceEnabled
        autoAdvanceMs={ADVERTISING_CAROUSEL_AUTO_ADVANCE_MS}
        autoAdvanceHoverIdleMs={ADVERTISING_CAROUSEL_HOVER_IDLE_MS}
      >
        {books.map((b) => (
          <BookScrollerCarouselItem key={`${b.id}-${b.slug ?? b.title}`}>
            <BookCard
              book={{
                id: Number(b.id),
                slug: b.slug,
                title: b.title,
                image: b.coverSrc,
                adult_content: b.isAdult,
                book_type: b.book_type ?? undefined,
                is_new_badge: b.is_new_badge,
                created_at: b.created_at,
              }}
              variant="ad"
              description={b.description}
            />
          </BookScrollerCarouselItem>
        ))}
      </BookScrollerCarousel>
    </>
  );

  return (
    <section
      className={styles.section}
      aria-roledescription="carousel"
      aria-label={title}
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
