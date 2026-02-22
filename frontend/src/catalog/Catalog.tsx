import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Container } from "../shared/Container";
import { BookCard } from "../BookCard/BookCard";
import {
  catalogKeys,
import { SortControl } from "../navigation/components/SortControl";
import { ShowMoreControl } from "../navigation/components/ShowMoreControl";
import { useSortedPaginatedList } from "../navigation/hooks/useSortedPaginatedList";
type SortKey = "created" | "views" | "incomeDay" | "incomeMonth";

const PAGE_SIZE = 8;
const SORT_OPTIONS: SortOption<SortKey>[] = [
  { value: "created", label: "Дата створення" },
  { value: "views", label: "Перегляди за день" },
  { value: "incomeDay", label: "Дохід за день" },
  { value: "incomeMonth", label: "Дохід за місяць" },
];

import type { SortOption } from "../navigation/types";
  getUserTranslations,
  type UserTranslationBook,
} from "../api/catalogApi";
import "./Catalog.css";

const MOCK_BOOKS: UserTranslationBook[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  owner: 0,
  slug: `catalog-mock-${index + 1}`,
  title: "",
  adult_content: true,
  created_at: "14.02.2023",
  const [sortBy, setSortBy] = useState<SortKey>("created");

  last_updated: "14.02.2023",
  daily_views: 457 + (index % 4) * 32,
  daily_income: 457 + (index % 3) * 18,
  monthly_income: 457 + (index % 5) * 14,
}));

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
  const { visibleItems: visibleBooks, hasMore, showMore } = useSortedPaginatedList({
    items: sourceBooks,
        <div className="catalog-page__topbar">
          <SortControl
            label=""
            value={sortBy}
            options={SORT_OPTIONS}
            onChange={setSortBy}
            ariaLabel="Сортування каталогу"

        <ShowMoreControl
          hasMore={hasMore}
          onShowMore={showMore}
          className="catalog-page__footer"
          ariaLabel="Показати ще книги каталогу"
        />
            className="catalog-page__sort"
          />
        </div>

    sortBy,
    pageSize: PAGE_SIZE,
    comparators,
  });

  const catalogQuery = useQuery({
    queryKey: catalogKeys.userTranslations(0),
    queryFn: getUserTranslations,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
  });

  const sourceBooks = catalogQuery.data?.length ? catalogQuery.data : MOCK_BOOKS;

  const visibleBooks = useMemo(
    () =>
      [...sourceBooks].sort(
        (a: UserTranslationBook, b: UserTranslationBook) =>
          toTimestamp(b.created_at) - toTimestamp(a.created_at)
      ),
    [sourceBooks]
  );

  return (
    <section className="catalog-page">
      <Container>
        <div className="catalog-page__grid">
          {visibleBooks.map((book) => (
            <div key={book.id} className="catalog-page__cell">
              <BookCard book={book} />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
