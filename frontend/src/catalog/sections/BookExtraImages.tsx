import { useMemo } from "react";
import type { BookExtraImage } from "../../api/catalogApi";
import { resolveBookCoverUrl } from "../../shared/bookCover/resolveBookCoverUrl";
import panelStyles from "../components/BookExtraImages/BookExtraImagesPanel.module.css";
import styles from "../styles/BookDetail.module.css";

type BookExtraImagesProps = {
  extraImages?: BookExtraImage[] | null;
  bookTitle?: string;
};

export function BookExtraImages({ extraImages, bookTitle }: BookExtraImagesProps) {
  const sortedImages = useMemo(() => {
    if (!extraImages?.length) return [];
    return [...extraImages]
      .filter((img) => img.image?.trim())
      .sort((a, b) => a.position - b.position);
  }, [extraImages]);

  if (sortedImages.length === 0) {
    return null;
  }

  const titleLabel = bookTitle?.trim() || "книги";

  return (
    <section className={styles.extraImagesSection} aria-label="Додаткові зображення">
      <div className={`${panelStyles.panel} ${panelStyles.panelDisplay}`}>
        <div className={panelStyles.panelTitlePill}>Додаткові зображення</div>
        <ul className={`${panelStyles.extraImagesRow} ${panelStyles.extraImagesRowDisplay}`}>
          {sortedImages.map((item) => (
            <li key={item.id} className={`${panelStyles.extraSlot} ${panelStyles.extraSlotStatic}`}>
              <img
                src={resolveBookCoverUrl(item.image)}
                alt={`Додаткове зображення до «${titleLabel}»`}
                className={panelStyles.extraSlotImage}
                loading="lazy"
                decoding="async"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
