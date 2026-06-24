import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SortByNavigation } from "../navigation/SortByNavigation.tsx";
import { PageTitle } from "../navigation/PageTitle";
import { Container } from "../shared/Container";
import { ShowMoreNavigation } from "../navigation/ShowMoreNavigation.tsx";
import styles from "./Authors.module.css";
import { getAuthorsList } from "./profileService";

type SortKey = "books" | "comments" | "lastVisit";
const PAGE_SIZE = 10;
const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "books", label: "Кількість книг" },
  { value: "comments", label: "К-сть коментарів" },
  { value: "lastVisit", label: "Останнє відвідування" },
];

function getSortLabelAndValue(sort: SortKey, row: AuthorRow): { label: string; value: string | number } {
  const opt = SORT_OPTIONS.find((o) => o.value === sort);
  const label = opt?.label ?? "";
  const value = sort === "books" ? row.booksCount : sort === "comments" ? row.commentsCount : row.lastVisit;
  return { label, value };
}

type AuthorRow = {
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

export default function Authors() {
  const [sort, setSort] = useState<SortKey>("books");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const {
    data: apiRows = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["authors-list"],
    queryFn: getAuthorsList,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
  });

  const sortedRows = useMemo(() => {
    const rows: AuthorRow[] = apiRows.map((row, index) => ({
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
    <section className={styles.page}>
      <Container>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <PageTitle>Автори</PageTitle>
            <p className={styles.sub}>Показано {sortedRows.length} робіт</p>
          </div>

          <div className={styles.headerRight}>
            <SortByNavigation
              value={sort}
              options={SORT_OPTIONS}
              onChange={(nextValue) => setSort(nextValue as SortKey)}
              ariaLabel="Сортувати авторів"
            />
          </div>
        </div>

        <div className={styles.tableScroll}>
          <div className={styles.tableFrame}>
            <div className={`${styles.row} ${styles.rowHead}`} role="row">
              <div className={`${styles.cell} ${styles.cellHeaderRank} ${styles.cellHead}`} role="columnheader">Місце<br />в<br />рейтингу</div>
              <div className={`${styles.cell} ${styles.cellHead}`} role="columnheader">Нікнейм</div>
              <div className={`${styles.cell} ${styles.cellDesktopOnly} ${styles.cellHead}`} role="columnheader">
                <span className={styles.headOrnament} aria-hidden="true" />
                К-сть книг
              </div>
              <div className={`${styles.cell} ${styles.cellDesktopOnly} ${styles.cellHead}`} role="columnheader">К-сть<br />коментарів</div>
              <div className={`${styles.cell} ${styles.cellDesktopOnly} ${styles.cellHead}`} role="columnheader">Останнє відвідування</div>
              <div className={`${styles.cell} ${styles.cellMobileOnly} ${styles.cellHead}`} role="columnheader">{SORT_OPTIONS.find((o) => o.value === sort)?.label ?? ""}</div>
            </div>

            <div className={styles.body} role="rowgroup">
              {isLoading ? (
                <div className={styles.row} role="row">
                  <div className={styles.cell} role="cell">Завантаження...</div>
                  <div className={styles.cell} role="cell" />
                  <div className={`${styles.cell} ${styles.cellDesktopOnly}`} role="cell" />
                  <div className={`${styles.cell} ${styles.cellDesktopOnly}`} role="cell" />
                  <div className={`${styles.cell} ${styles.cellDesktopOnly}`} role="cell" />
                  <div className={`${styles.cell} ${styles.cellMobileOnly}`} role="cell" />
                </div>
              ) : isError ? (
                <div className={styles.row} role="row">
                  <div className={styles.cell} role="cell">Помилка завантаження</div>
                  <div className={styles.cell} role="cell" />
                  <div className={`${styles.cell} ${styles.cellDesktopOnly}`} role="cell" />
                  <div className={`${styles.cell} ${styles.cellDesktopOnly}`} role="cell" />
                  <div className={`${styles.cell} ${styles.cellDesktopOnly}`} role="cell" />
                  <div className={`${styles.cell} ${styles.cellMobileOnly}`} role="cell" />
                </div>
              ) : visibleRows.map((row) => {
                const { label: sortLabel, value: sortValue } = getSortLabelAndValue(sort, row);
                return (
                <div key={`${row.nickname}-${row.rank}`} className={styles.row} role="row" tabIndex={0}>
                  <span className={styles.rowHoverFrame} aria-hidden="true">
                    <svg
                      className={styles.rowHoverSvg}
                      viewBox="0 0 1399 67"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <use href="/sprite-book.svg#authors-row-hover-frame" />
                    </svg>
                  </span>

                  <div className={`${styles.cell} ${styles.cellItalic}`} role="cell">
                    {row.rank}
                  </div>
                  <div className={`${styles.cell} ${styles.cellNick}`} role="cell">
                    {row.nickname}
                  </div>
                  <div className={`${styles.cell} ${styles.cellCenter} ${styles.cellItalic} ${styles.cellDesktopOnly}`} role="cell">
                    {row.booksCount}
                  </div>
                  <div className={`${styles.cell} ${styles.cellCenter} ${styles.cellItalic} ${styles.cellDesktopOnly}`} role="cell">
                    {row.commentsCount}
                  </div>
                  <div className={`${styles.cell} ${styles.cellCenter} ${styles.cellItalic} ${styles.cellDesktopOnly}`} role="cell">
                    {row.lastVisit}
                  </div>
                  <div className={`${styles.cell} ${styles.cellCenter} ${styles.cellItalic} ${styles.cellMobileOnly}`} role="cell" title={sortLabel}>
                    {sortValue}
                  </div>
                </div>
              );})}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <ShowMoreNavigation
            visibleCount={visibleCount}
            totalCount={sortedRows.length}
            onShowMore={showMore}
            ariaLabel="Показати ще авторів"
          />
        </div>
      </Container>
    </section>
  );
}