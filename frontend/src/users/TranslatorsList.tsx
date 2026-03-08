import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Container } from "../shared/Container";
import { ShowMoreNavigation } from "../navigation/ShowMoreNavigation.tsx";
import { SortByNavigation } from "../navigation/SortByNavigation.tsx";
import { PageTitle } from "../navigation/PageTitle";
import { getTranslatorsList } from "./profileService";
import "./TranslatorsList.css";

type SortKey = "books" | "comments" | "lastVisit";
const PAGE_SIZE = 1;
const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "books", label: "Кількість книг" },
  { value: "comments", label: "К-сть коментарів" },
  { value: "lastVisit", label: "Останнє відвідування" },
];

function getSortLabelAndValue(sort: SortKey, row: TranslatorRow): { label: string; value: string | number } {
  const opt = SORT_OPTIONS.find((o) => o.value === sort);
  const label = opt?.label ?? "";
  const value = sort === "books" ? row.booksCount : sort === "comments" ? row.commentsCount : row.lastVisit;
  return { label, value };
}

type TranslatorRow = {
  rank: number;
  nickname: string;
  booksCount: number;
  commentsCount: number;
  lastVisit: string;
};

function parseUkDate(value: string): number {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    return 0;
  }
  const [day, month, year] = value.split(".");
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  return new Date(y, m - 1, d).getTime();
}

export default function TranslatorsList() {
  const [sort, setSort] = useState<SortKey>("books");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const {
    data: apiRows = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["translators-list"],
    queryFn: getTranslatorsList,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
  });

  const sortedRows = useMemo(() => {
    const rows: TranslatorRow[] = apiRows.map((row, index) => ({
      rank: index + 1,
      nickname: row.nickname || row.username,
      booksCount: Number(row.books_count ?? 0),
      commentsCount: Number(row.comments_count ?? 0),
      lastVisit: row.last_visit || "Н/Д",
    }));

    const copy = [...rows];
    if (sort === "books") {
      copy.sort((a, b) => b.booksCount - a.booksCount);
    } else if (sort === "comments") {
      copy.sort((a, b) => b.commentsCount - a.commentsCount);
    } else {
      copy.sort((a, b) => parseUkDate(b.lastVisit) - parseUkDate(a.lastVisit));
    }
    return copy.map((row, index) => ({ ...row, rank: index + 1 }));
  }, [apiRows, sort]);

  const visibleRows = useMemo(
    () => sortedRows.slice(0, visibleCount),
    [sortedRows, visibleCount]
  );
  const showMore = () => setVisibleCount((prev) => prev + PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sort, apiRows.length]);

  return (
    <section className="translators-list-page">
      <Container>
        <div className="translators-list-header">
          <div className="translators-list-header-left">
            <PageTitle>Перекладачі</PageTitle>
            <p className="translators-list-sub">Показано {sortedRows.length} робіт</p>
          </div>

          <div className="translators-list-header-right">
            <SortByNavigation
              value={sort}
              options={SORT_OPTIONS}
              onChange={(nextValue) => setSort(nextValue as SortKey)}
              ariaLabel="Сортувати перекладачів"
              labelText="Сортувати за"
            />
          </div>
        </div>

        <div className="translators-list-table-scroll">
          <div className="translators-list-table-frame">
            <div className="translators-list-row translators-list-row-head" role="row">
              <div className="translators-list-cell translators-list-cell-header-rank translators-list-cell-head" role="columnheader">Місце<br />в<br />рейтингу</div>
              <div className="translators-list-cell translators-list-cell-head" role="columnheader">Нікнейм</div>
              <div className="translators-list-cell translators-list-cell-desktop-only translators-list-cell-head" role="columnheader">
                <span className="translators-list-head-ornament" aria-hidden="true" />
                К-сть книг
              </div>
              <div className="translators-list-cell translators-list-cell-desktop-only translators-list-cell-head" role="columnheader">К-сть<br />коментарів</div>
              <div className="translators-list-cell translators-list-cell-desktop-only translators-list-cell-head" role="columnheader">Останнє відвідування</div>
              <div className="translators-list-cell translators-list-cell-mobile-only translators-list-cell-head" role="columnheader">{SORT_OPTIONS.find((o) => o.value === sort)?.label ?? ""}</div>
            </div>

            <div className="translators-list-body" role="rowgroup">
              {isLoading ? (
                <div className="translators-list-row" role="row">
                  <div className="translators-list-cell" role="cell">Завантаження...</div>
                  <div className="translators-list-cell" role="cell" />
                  <div className="translators-list-cell translators-list-cell-desktop-only" role="cell" />
                  <div className="translators-list-cell translators-list-cell-desktop-only" role="cell" />
                  <div className="translators-list-cell translators-list-cell-desktop-only" role="cell" />
                  <div className="translators-list-cell translators-list-cell-mobile-only" role="cell" />
                </div>
              ) : isError ? (
                <div className="translators-list-row" role="row">
                  <div className="translators-list-cell" role="cell">Помилка завантаження</div>
                  <div className="translators-list-cell" role="cell" />
                  <div className="translators-list-cell translators-list-cell-desktop-only" role="cell" />
                  <div className="translators-list-cell translators-list-cell-desktop-only" role="cell" />
                  <div className="translators-list-cell translators-list-cell-desktop-only" role="cell" />
                  <div className="translators-list-cell translators-list-cell-mobile-only" role="cell" />
                </div>
              ) : visibleRows.map((row) => {
                const { label: sortLabel, value: sortValue } = getSortLabelAndValue(sort, row);
                return (
                <div key={`${row.nickname}-${row.rank}`} className="translators-list-row" role="row" tabIndex={0}>
                  <span className="translators-list-row-hover-frame" aria-hidden="true">
                    <svg
                      className="translators-list-row-hover-svg"
                      viewBox="0 0 1399 67"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <use href="/sprite-book.svg#authors-row-hover-frame" />
                    </svg>
                  </span>

                  <div className="translators-list-cell translators-list-cell-number" role="cell">
                    {row.rank}
                  </div>
                  <div className="translators-list-cell translators-list-cell-nick" role="cell">
                    {row.nickname}
                  </div>
                  <div className="translators-list-cell translators-list-cell-center translators-list-cell-number translators-list-cell-desktop-only" role="cell">
                    {row.booksCount}
                  </div>
                  <div className="translators-list-cell translators-list-cell-center translators-list-cell-number translators-list-cell-desktop-only" role="cell">
                    {row.commentsCount}
                  </div>
                  <div className="translators-list-cell translators-list-cell-center translators-list-cell-number translators-list-cell-desktop-only" role="cell">
                    {row.lastVisit}
                  </div>
                  <div className="translators-list-cell translators-list-cell-center translators-list-cell-number translators-list-cell-mobile-only" role="cell" title={sortLabel}>
                    {sortValue}
                  </div>
                </div>
              );})}
            </div>
          </div>
        </div>

        <div className="translators-list-footer">
          <ShowMoreNavigation
            visibleCount={visibleCount}
            totalCount={sortedRows.length}
            onShowMore={showMore}
            ariaLabel="Показати ще перекладачів"
          />
        </div>
      </Container>
    </section>
  );
}