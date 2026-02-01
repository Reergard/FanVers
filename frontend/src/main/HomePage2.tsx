import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { http } from "../api/http";
import styles from "./HomePage.module.css";

interface BookFromApi {
  id: number;
  title: string;
  slug: string;
}

async function fetchBooksNews(): Promise<BookFromApi[]> {
  const { data } = await http.get<BookFromApi[]>("/api/main/books-news/");
  return Array.isArray(data) ? data : [];
}

export function HomePage2() {
  const { data: books = [] } = useQuery({
    queryKey: ["books-news"],
    queryFn: fetchBooksNews,
  });
  const book = books[0];

  return (
    <div className={styles.section2}>
      <h2>Секция 2</h2>
      <p>Контент второй секции главной страницы</p>
      {book && (
        <p>
          <Link to={`/books/${book.slug}`}>{book.title}</Link>
        </p>
      )}
    </div>
  );
}

export default HomePage2;