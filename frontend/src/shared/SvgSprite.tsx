import sprite from "/sprite.svg?raw";

export function SvgSprite() {
  // Важно: спрайт должен быть в DOM, тогда фильтры/defs работают
  return <div style={{ display: "none" }} dangerouslySetInnerHTML={{ __html: sprite }} />;
}
