import { useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { useNotification } from "../../shared/NotificationModal/NotificationProvider";
import { submitRating, type RatingType } from "../../api/ratingApi";
import { requestThrottle, createRequestKey } from "../../shared/utils/requestThrottle";
import styles from "../styles/BookDetail.module.css";

export interface BookRatingStarsProps {
  bookSlug: string;
  ratingType: RatingType;
  title: string;
  average: number;
  totalVotes: number;
  userRating: number | undefined | null;
  isLoading: boolean;
  onRatingSuccess: () => void;
}

export function BookRatingStars({
  bookSlug,
  ratingType,
  title,
  average,
  totalVotes,
  userRating,
  isLoading,
  onRatingSuccess,
}: BookRatingStarsProps) {
  const { isAuthenticated } = useAuth();
  const { showError, showWarning } = useNotification();
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleStarClick = async (selectedRating: number) => {
    if (!isAuthenticated) {
      showWarning("Для голосування необхідно увійти в систему");
      return;
    }
    const value = Math.min(5, Math.max(1, Math.floor(Number(selectedRating) || 0))) || 1;

    const key = createRequestKey(bookSlug, ratingType, "submit");
    setSubmitting(true);
    try {
      await requestThrottle.addRequest(key, () =>
        submitRating(bookSlug, ratingType, value)
      );
      onRatingSuccess();
    } catch (err: unknown) {
      const status =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      const data =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: Record<string, unknown> } }).response?.data
          : undefined;
      const msg =
        typeof data?.error === "string"
          ? data.error
          : typeof data?.detail === "string"
            ? data.detail
            : Array.isArray(data?.rating)
              ? (data.rating as string[])[0]
              : null;
      if (status === 429) {
        showError("Забагато спроб. Зачекайте кілька секунд і спробуйте знову.");
        return;
      }
      showError(
        msg && msg.length > 0 ? msg : "Помилка при голосуванні"
      );
    } finally {
      setSubmitting(false);
    }
  };

  /** Три стани: сірий (не оцінено), середній жовтий (загальний рейтинг), яскравий жовтий (ваша оцінка або hover).
   * Для "загального рейтингу" використовуємо округлене середнє (round), щоб після вашого голосу (наприклад 2)
   * при загальному 4 залишались 3-тя і 4-та зірки кольору рейтингу, 5-та сіра. */
  const getStarState = (
    starNumber: number
  ): "empty" | "average" | "filled" => {
    if (starNumber < 1 || starNumber > 5) return "empty";
    if (hoverRating >= starNumber) return "filled";
    const user = userRating != null ? Math.min(5, Math.max(0, Math.floor(Number(userRating)))) : 0;
    if (user >= starNumber) return "filled";
    const roundedAverage = Math.min(5, Math.max(0, Math.round(Number(average)) || 0));
    if (roundedAverage >= starNumber) return "average";
    return "empty";
  };

  const getStarClassName = (starNumber: number): string => {
    const state = getStarState(starNumber);
    return `${styles.ratingStarBtn} ${styles[state === "empty" ? "ratingStarEmpty" : state === "average" ? "ratingStarAverage" : "ratingStarFilled"]}`;
  };

  if (isLoading) {
    return (
      <div className={styles.ratingBox}>
        <div className={styles.ratingTitle}>{title}</div>
        <div className={styles.ratingStars} aria-busy="true">
          <span>Завантаження…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.ratingBox}>
      <div className={styles.ratingTitle}>{title}</div>
      <div
        className={styles.ratingStars}
        role="group"
        aria-label={`${title} ${Number(average) > 0 ? `${Number(average).toFixed(1)} з 5` : "оцінити"}`}
      >
        {[1, 2, 3, 4, 5].map((starNumber) => (
          <button
            key={starNumber}
            type="button"
            className={getStarClassName(starNumber)}
            disabled={submitting}
            aria-label={
              hoverRating >= starNumber
                ? `Оцінити на ${starNumber} зірок`
                : userRating != null && Number(userRating) >= starNumber
                  ? `Ваша оцінка: ${starNumber} зірок`
                  : `Оцінити на ${starNumber} зірок`
            }
            onClick={() => handleStarClick(starNumber)}
            onMouseEnter={() => setHoverRating(starNumber)}
            onMouseLeave={() => setHoverRating(0)}
            style={{
              cursor: isAuthenticated && !submitting ? "pointer" : "default",
            }}
          >
            ★
          </button>
        ))}
      </div>
      {Math.max(0, Math.floor(Number(totalVotes) || 0)) > 0 && (
        <div className={styles.ratingHint}>
          ({Number(average).toFixed(1)} / {Math.max(0, Math.floor(Number(totalVotes) || 0))} голосів)
        </div>
      )}
    </div>
  );
}
