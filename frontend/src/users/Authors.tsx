import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Container } from "../shared/Container";
import { ShowMoreButton } from "../shared/ActionButton/ActionButton";
import styles from "./Authors.module.css";
import rowHoverFrameSvg from "../assets/backgrounds/Рамка Авторов.svg";
import { getAuthorsList } from "./profileService";

type SortKey = "books" | "comments" | "lastVisit";

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

  return (
    <section className={styles.page}>
      <Container>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>Автори</h1>
            <p className={styles.sub}>Показано {sortedRows.length} робіт</p>
          </div>

          <div className={styles.headerRight}>
            <span className={styles.sortLabel}>Сортувати</span>
            <label className={styles.sortPill}>
              <span className={styles.sortPillText}>
                {sort === "books" && "Кількість книг"}
                {sort === "comments" && "К-сть коментарів"}
                {sort === "lastVisit" && "Останнє відвідування"}
              </span>
              <select
                className={styles.sortSelect}
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label="Сортувати авторів"
              >
                <option value="books">Кількість книг</option>
                <option value="comments">К-сть коментарів</option>
                <option value="lastVisit">Останнє відвідування</option>
              </select>
              <span className={styles.sortCaret} aria-hidden="true" />
            </label>
          </div>
        </div>

        <div className={styles.tableScroll}>
          <div className={styles.tableFrame}>
            <div className={`${styles.row} ${styles.rowHead}`} role="row">
              <div className={styles.cell} role="columnheader">
                Місце в рейтингу
              </div>
              <div className={styles.cell} role="columnheader">
                Нікнейм
              </div>
              <div className={`${styles.cell} ${styles.cellCenter}`} role="columnheader">
                <span className={styles.headOrnament} aria-hidden="true" />
                К-сть книг
              </div>
              <div className={`${styles.cell} ${styles.cellCenter}`} role="columnheader">
                К-сть коментарів
              </div>
              <div className={`${styles.cell} ${styles.cellCenter}`} role="columnheader">
                Останнє відвідування
              </div>
            </div>

            <div className={styles.body} role="rowgroup">
              {isLoading ? (
                <div className={styles.row} role="row">
                  <div className={styles.cell} role="cell">Завантаження...</div>
                  <div className={styles.cell} role="cell" />
                  <div className={styles.cell} role="cell" />
                  <div className={styles.cell} role="cell" />
                  <div className={styles.cell} role="cell" />
                </div>
              ) : isError ? (
                <div className={styles.row} role="row">
                  <div className={styles.cell} role="cell">Помилка завантаження</div>
                  <div className={styles.cell} role="cell" />
                  <div className={styles.cell} role="cell" />
                  <div className={styles.cell} role="cell" />
                  <div className={styles.cell} role="cell" />
                </div>
              ) : sortedRows.map((row) => (
                <div key={`${row.nickname}-${row.rank}`} className={styles.row} role="row" tabIndex={0}>
                  <span className={styles.rowHoverFrame} aria-hidden="true">
                    <img
                      className={styles.rowHoverSvg}
                      src={rowHoverFrameSvg}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </span>

                  <div className={`${styles.cell} ${styles.cellItalic}`} role="cell">
                    {row.rank}
                  </div>
                  <div className={`${styles.cell} ${styles.cellNick}`} role="cell">
                    {row.nickname}
                  </div>
                  <div className={`${styles.cell} ${styles.cellCenter} ${styles.cellItalic}`} role="cell">
                    {row.booksCount}
                  </div>
                  <div className={`${styles.cell} ${styles.cellCenter} ${styles.cellItalic}`} role="cell">
                    {row.commentsCount}
                  </div>
                  <div className={`${styles.cell} ${styles.cellCenter} ${styles.cellItalic}`} role="cell">
                    {row.lastVisit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <ShowMoreButton ariaLabel="Показати ще авторів">
            Показати ще
          </ShowMoreButton>
        </div>
      </Container>
    </section>
  );
}
