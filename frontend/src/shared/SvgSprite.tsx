import sprite from "/sprite.svg?raw";

export function SvgSprite() {
  // SECURITY: статичний asset з репозиторію (?raw). Не підміняти на динамічний вміст без DOMPurify (svg profile).
  // Важно: спрайт должен быть в DOM, тогда фильтры/defs работают
  return <div style={{ display: "none" }} dangerouslySetInnerHTML={{ __html: sprite }} />;
}
