import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookCard } from "../BookCard/BookCard";
import {
  catalogKeys,
  getAllCatalogBooks,
  type UserTranslationBook,
} from "../api/catalogApi";
import {
  getCatalogPageAds,
  advertisingKeys,
} from "../api/advertisingApi";
import { AdvertisingCarousel } from "../website_advertising/AdvertisingBooks";
import { Container } from "../shared/Container";
import { ShowMoreNavigation } from "../navigation/ShowMoreNavigation.tsx";
import { SortByNavigation } from "../navigation/SortByNavigation.tsx";
import { PageTitle } from "../navigation/PageTitle";
import "./Catalog.css";

type SortKey = "created" | "views" | "incomeDay" | "incomeMonth";
const PAGE_SIZE = 8;

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "created", label: "Дата створення" },
  { value: "views", label: "Перегляди за день" },
  { value: "incomeDay", label: "Дохід за день" },
  { value: "incomeMonth", label: "Дохід за місяць" },
];

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    const [day, month, year] = value.split(".");
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

export default function Catalog() {
  const [sortBy, setSortBy] = useState<SortKey>("created");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const catalogQuery = useQuery({
    queryKey: catalogKeys.allBooks(),
    queryFn: getAllCatalogBooks,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
  });

  const sourceBooks = catalogQuery.data ?? [];

  const comparators = useMemo(
    () => ({
      created: (a: UserTranslationBook, b: UserTranslationBook) =>
        toTimestamp(b.created_at) - toTimestamp(a.created_at),
      views: (a: UserTranslationBook, b: UserTranslationBook) =>
        Number(b.daily_views ?? 0) - Number(a.daily_views ?? 0),
      incomeDay: (a: UserTranslationBook, b: UserTranslationBook) =>
        Number(b.daily_income ?? 0) - Number(a.daily_income ?? 0),
      incomeMonth: (a: UserTranslationBook, b: UserTranslationBook) =>
        Number(b.monthly_income ?? 0) - Number(a.monthly_income ?? 0),
    }),
    []
  );

  const sortedBooks = useMemo(() => {
    const copy = [...sourceBooks];
    const comparator = comparators[sortBy];
    copy.sort(comparator);
    return copy;
  }, [sourceBooks, sortBy, comparators]);

  const visibleBooks = sortedBooks.slice(0, visibleCount);
  const showMore = () =>
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, sortedBooks.length));

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sortBy, sourceBooks.length]);

  return (
    <section className="catalog-page">
      <Container>
        <PageTitle>Каталог</PageTitle>
        <AdvertisingCarousel
          queryKey={advertisingKeys.catalogPage()}
          queryFn={getCatalogPageAds}
          withContainer={false}
        />
        <div className="catalog-page__topbar">
          <SortByNavigation
            className="catalog-page__sort"
            value={sortBy}
            options={SORT_OPTIONS}
            onChange={(nextValue) => setSortBy(nextValue as SortKey)}
            ariaLabel="Сортування каталогу"
            labelText="Сортувати за"
          />
        </div>

        <div className="catalog-page__grid">
          {visibleBooks.map((book) => (
            <div key={book.id} className="catalog-page__cell">
              <BookCard book={book} />
            </div>
          ))}
        </div>

        <div className="catalog-page__footer">
          <ShowMoreNavigation
            visibleCount={visibleCount}
            totalCount={sortedBooks.length}
            onShowMore={showMore}
            ariaLabel="Показати ще книги каталогу"
          />
        </div>
      </Container>
    </section>
  );
}
