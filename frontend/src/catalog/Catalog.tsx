import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookCard } from "../BookCard/BookCard";
import {
  catalogKeys,
  getUserTranslations,
  type UserTranslationBook,
} from "../api/catalogApi";
import { Container } from "../shared/Container";
import { ShowMoreButton } from "../shared/ActionButton/ActionButton";
import "./Catalog.css";

type SortKey = "created" | "views" | "incomeDay" | "incomeMonth";

const PAGE_SIZE = 8;
const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "created", label: "Дата створення" },
  { value: "views", label: "Перегляди за день" },
  { value: "incomeDay", label: "Дохід за день" },
  { value: "incomeMonth", label: "Дохід за місяць" },
];

const MOCK_BOOKS: UserTranslationBook[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  owner: 0,
  slug: `catalog-mock-${index + 1}`,
  title: "",
  adult_content: true,
  created_at: "14.02.2023",
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
  const [sortBy, setSortBy] = useState<SortKey>("created");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const catalogQuery = useQuery({
    queryKey: catalogKeys.userTranslations(0),
    queryFn: getUserTranslations,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
  });

  const sourceBooks = catalogQuery.data?.length ? catalogQuery.data : MOCK_BOOKS;

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
  const hasMore = visibleCount < sortedBooks.length;
  const showMore = () => setVisibleCount((prev) => prev + PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sortBy, sourceBooks.length]);

  return (
    <section className="catalog-page">
      <Container>
        <div className="catalog-page__topbar">
          <label className="catalog-page__sort">
            <span>Сортувати</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortKey)}
              aria-label="Сортування каталогу"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="catalog-page__grid">
          {visibleBooks.map((book) => (
            <div key={book.id} className="catalog-page__cell">
              <BookCard book={book} />
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="catalog-page__footer">
            <ShowMoreButton onClick={showMore} ariaLabel="Показати ще книги каталогу">
              Показати ще
            </ShowMoreButton>
          </div>
        )}
      </Container>
    </section>
  );
}
