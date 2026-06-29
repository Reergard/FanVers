import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./OverflowMarqueeText.module.css";

const MARQUEE_GAP_EM = 2;
const MARQUEE_PX_PER_SECOND = 42;

type OverflowMarqueeTextProps = {
  text: string;
  className?: string;
  /** DEV: жовтий фон viewport — видно межі блоку */
  devHighlight?: boolean;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Одна строка: ellipsis, якщо вміщається; бегуча строка при переповненні
 * (логіка як у BookCardTitle).
 */
export function OverflowMarqueeText({
  text,
  className,
  devHighlight = false,
}: OverflowMarqueeTextProps) {
  const displayText = text.trim() || "—";
  const viewportRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isMarquee, setIsMarquee] = useState(false);
  const [marqueeDuration, setMarqueeDuration] = useState("12s");

  useEffect(() => {
    const viewport = viewportRef.current;
    const textEl = textRef.current;
    if (!viewport || !textEl) return;

    const sync = () => {
      const cs = getComputedStyle(viewport);
      const padX =
        (Number.parseFloat(cs.paddingLeft) || 0) +
        (Number.parseFloat(cs.paddingRight) || 0);
      const trackEl = textEl.parentElement;
      const trackPadX = trackEl
        ? (Number.parseFloat(getComputedStyle(trackEl).paddingLeft) || 0) +
          (Number.parseFloat(getComputedStyle(trackEl).paddingRight) || 0)
        : 0;
      const availableWidth = viewport.clientWidth - padX - trackPadX;
      const overflow = textEl.scrollWidth > availableWidth + 1;
      const active = overflow && !prefersReducedMotion();
      setIsMarquee(active);
      if (active) {
        const seconds = Math.max(
          6,
          Math.min(24, textEl.scrollWidth / MARQUEE_PX_PER_SECOND),
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
  }, [displayText]);

  const marqueeStyle = isMarquee
    ? ({
        "--overflow-marquee-duration": marqueeDuration,
        "--overflow-marquee-gap": `${MARQUEE_GAP_EM}em`,
      } as CSSProperties)
    : undefined;

  return (
    <span
      ref={viewportRef}
      className={[
        styles.viewport,
        devHighlight ? styles.viewportDev : "",
        isMarquee ? styles.viewportMarquee : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={marqueeStyle}
    >
      <span
        className={[styles.track, isMarquee ? styles.trackMarquee : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <span ref={textRef} className={styles.text}>
          {displayText}
        </span>
        {isMarquee ? (
          <span className={styles.text} aria-hidden="true">
            {displayText}
          </span>
        ) : null}
      </span>
    </span>
  );
}
