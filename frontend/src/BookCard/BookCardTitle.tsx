import { useEffect, useRef, useState, type CSSProperties } from "react";

export type BookCardTitleVariant =
  | "default"
  | "withTags"
  | "bookmark"
  | "ad"
  | "carousel";

type BookCardTitleProps = {
  title?: string | null;
  variant?: BookCardTitleVariant;
  className?: string;
};

const MARQUEE_GAP_EM = 2;
const MARQUEE_PX_PER_SECOND = 42;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Назва книги в картці: спільна типографіка варіанта + ellipsis або бегуча строка,
 * якщо текст не вміщається в ширину блоку (без зміни ширини контейнера).
 */
export function BookCardTitle({
  title,
  variant = "default",
  className,
}: BookCardTitleProps) {
  const displayTitle = title?.trim() ? title.trim() : "Без назви";
  const viewportRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isMarquee, setIsMarquee] = useState(false);
  const [marqueeDuration, setMarqueeDuration] = useState("12s");

  const headingClassName = [
    "bookCard__title",
    variant !== "default" ? `bookCard__title--${variant}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    const viewport = viewportRef.current;
    const text = textRef.current;
    if (!viewport || !text) return;

    const sync = () => {
      const overflow = text.scrollWidth > viewport.clientWidth + 1;
      const active = overflow && !prefersReducedMotion();
      setIsMarquee(active);
      if (active) {
        const seconds = Math.max(
          6,
          Math.min(24, text.scrollWidth / MARQUEE_PX_PER_SECOND),
        );
        setMarqueeDuration(`${seconds}s`);
      }
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(viewport);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", sync);

    return () => {
      ro.disconnect();
      mq.removeEventListener("change", sync);
    };
  }, [displayTitle, variant]);

  const marqueeStyle = isMarquee
    ? ({
        "--bookcard-title-marquee-duration": marqueeDuration,
        "--bookcard-title-marquee-gap": `${MARQUEE_GAP_EM}em`,
      } as CSSProperties)
    : undefined;

  const heading = (
    <h3 className={headingClassName}>
      <span
        ref={viewportRef}
        className={[
          "bookCard__titleViewport",
          isMarquee ? "bookCard__titleViewport--marquee" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={marqueeStyle}
      >
        <span
          className={[
            "bookCard__titleTrack",
            isMarquee ? "bookCard__titleTrack--marquee" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span ref={textRef} className="bookCard__titleText">
            {displayTitle}
          </span>
          {isMarquee ? (
            <span
              className="bookCard__titleText bookCard__titleText--clone"
              aria-hidden="true"
            >
              {displayTitle}
            </span>
          ) : null}
        </span>
      </span>
    </h3>
  );

  if (variant === "withTags") {
    return (
      <div className="bookCard__title-wrap">
        <span className="bookCard__title-inner">{heading}</span>
      </div>
    );
  }

  return heading;
}
