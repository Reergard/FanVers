import styles from "../styles/BookDetail.module.css";

type BookDescriptionProps = {
  description: string | null | undefined;
};

function paragraphize(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed.split(/\n\n+/).filter(Boolean);
}

export function BookDescription({ description }: BookDescriptionProps) {
  if (description == null || description === "") {
    return null;
  }

  const paragraphs = paragraphize(description);

  return (
    <section className={styles.description} aria-labelledby="book-description-heading">
      <div className={styles.headingWithLine}>
        <h3 id="book-description-heading">Опис книги:</h3>
        <span className={styles.headingLine} aria-hidden="true" />
      </div>
      <div className={styles.text}>
        {paragraphs.length > 0 ? (
          paragraphs.map((p, i) => <p key={i}>{p}</p>)
        ) : (
          <p>{description}</p>
        )}
      </div>
    </section>
  );
}
