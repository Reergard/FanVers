import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Container } from "../shared/Container";
import { ShowMoreButton } from "../shared/ActionButton/ActionButton";
import rowHoverFrameSvg from "../assets/backgrounds/Рамка Авторов.svg";
import { getTranslatorsList } from "./profileService";
import "./TranslatorsList.css";

type SortKey = "books" | "comments" | "lastVisit";

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

  return (
    <section className="translators-list-page">
      <Container>
        <div className="translators-list-header">
          <div className="translators-list-header-left">
            <h1 className="translators-list-title">Перекладачі</h1>
            <p className="translators-list-sub">Показано {sortedRows.length} робіт</p>
          </div>

          <div className="translators-list-header-right">
            <span className="translators-list-sort-label">Сортувати</span>
            <label className="translators-list-sort-pill">
              <span className="translators-list-sort-pill-text">
                {sort === "books" && "Кількість книг"}
                {sort === "comments" && "К-сть коментарів"}
                {sort === "lastVisit" && "Останнє відвідування"}
              </span>
              <select
                className="translators-list-sort-select"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label="Сортувати перекладачів"
              >
                <option value="books">Кількість книг</option>
                <option value="comments">К-сть коментарів</option>
                <option value="lastVisit">Останнє відвідування</option>
              </select>
              <span className="translators-list-sort-caret" aria-hidden="true" />
            </label>
          </div>
        </div>

        <div className="translators-list-table-scroll">
          <div className="translators-list-table-frame">
            <div className="translators-list-row translators-list-row-head" role="row">
              <div className="translators-list-cell" role="columnheader">
                Місце в рейтингу
              </div>
              <div className="translators-list-cell" role="columnheader">
                Нікнейм
              </div>
              <div className="translators-list-cell translators-list-cell-center" role="columnheader">
                <span className="translators-list-head-ornament" aria-hidden="true" />
                К-сть книг
              </div>
              <div className="translators-list-cell translators-list-cell-center" role="columnheader">
                К-сть коментарів
              </div>
              <div className="translators-list-cell translators-list-cell-center" role="columnheader">
                Останнє відвідування
              </div>
            </div>

            <div className="translators-list-body" role="rowgroup">
              {isLoading ? (
                <div className="translators-list-row" role="row">
                  <div className="translators-list-cell" role="cell">Завантаження...</div>
                  <div className="translators-list-cell" role="cell" />
                  <div className="translators-list-cell" role="cell" />
                  <div className="translators-list-cell" role="cell" />
                  <div className="translators-list-cell" role="cell" />
                </div>
              ) : isError ? (
                <div className="translators-list-row" role="row">
                  <div className="translators-list-cell" role="cell">Помилка завантаження</div>
                  <div className="translators-list-cell" role="cell" />
                  <div className="translators-list-cell" role="cell" />
                  <div className="translators-list-cell" role="cell" />
                  <div className="translators-list-cell" role="cell" />
                </div>
              ) : sortedRows.map((row) => (
                <div key={`${row.nickname}-${row.rank}`} className="translators-list-row" role="row" tabIndex={0}>
                  <span className="translators-list-row-hover-frame" aria-hidden="true">
                    <img
                      className="translators-list-row-hover-svg"
                      src={rowHoverFrameSvg}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </span>

                  <div className="translators-list-cell translators-list-cell-number" role="cell">
                    {row.rank}
                  </div>
                  <div className="translators-list-cell translators-list-cell-nick" role="cell">
                    {row.nickname}
                  </div>
                  <div className="translators-list-cell translators-list-cell-center translators-list-cell-number" role="cell">
                    {row.booksCount}
                  </div>
                  <div className="translators-list-cell translators-list-cell-center translators-list-cell-number" role="cell">
                    {row.commentsCount}
                  </div>
                  <div className="translators-list-cell translators-list-cell-center translators-list-cell-number" role="cell">
                    {row.lastVisit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="translators-list-footer">
          <ShowMoreButton ariaLabel="Показати ще перекладачів">Показати ще</ShowMoreButton>
        </div>
      </Container>
    </section>
  );
}
