import spriteBook from "/sprite-book.svg?raw";

/**
 * Спрайт іконок для сторінок книг/глав/читалки.
 * Підключати тільки на цих сторінках, щоб не збільшувати стартовий бандл.
 *
 * SECURITY: лише статичний `/sprite-book.svg` з білду. Динамічний SVG — через DOMPurify (svg).
 */
export function SvgSpriteBook() {
  return (
    <div style={{ display: "none" }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: spriteBook }} />
  );
}
