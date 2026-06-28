import { useQuery } from "@tanstack/react-query";
import { BookCard } from "../../BookCard/BookCard";
import {
  catalogKeys,
  getAuthorOtherWorks,
} from "../../api/catalogApi";
import {
  BookScrollerCarousel,
  BookScrollerCarouselItem,
} from "../../shared/carousel/BookScrollerCarousel";
import styles from "../styles/BookDetail.module.css";

type AuthorWorksProps = {
  bookSlug: string;
};

export function AuthorWorks({ bookSlug }: AuthorWorksProps) {
  const { data: books = [], isPending, isError } = useQuery({
    queryKey: catalogKeys.authorOtherWorks(bookSlug),
    queryFn: () => getAuthorOtherWorks(bookSlug),
    enabled: Boolean(bookSlug),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isPending || isError || books.length === 0) {
    return null;
  }

  return (
    <section
      className={styles.authorWorks}
      aria-labelledby="author-works-heading"
      aria-roledescription="carousel"
    >
      <div className={styles.headingWithLine}>
        <h3 id="author-works-heading">ІНШІ РОБОТИ АВТОРА:</h3>
        <span className={styles.headingLine} aria-hidden="true" />
      </div>

      <div className={styles.authorWorksInner}>
        <BookScrollerCarousel
          itemCount={books.length}
          carouselClassName={styles.authorWorksCarousel}
          wrapClassName={styles.authorWorksCarouselWrap}
          navClassName={styles.authorWorksNav}
        >
          {books.map((book) => (
            <BookScrollerCarouselItem key={book.id}>
              <BookCard book={book} variant="carousel" />
            </BookScrollerCarouselItem>
          ))}
        </BookScrollerCarousel>
      </div>
    </section>
  );
}
