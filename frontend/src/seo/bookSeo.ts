const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || "https://fan-vers.com";

export const SEO_BOOK_TITLE_SUFFIX = "— читати ранобе українською онлайн безкоштовно | FanVers";

const SEO_BOOK_DESCRIPTION_PREFIX = (title: string) =>
  `Читати ранобе «${title}» українською мовою онлайн.`;

const SEO_BOOK_DESCRIPTION_SUFFIX =
  "Найкраще ранобе українською. Читати онлайн безкоштовно. Кращий вибір новел на FanVers.";

export function cleanUserDescription(htmlOrText: string | null | undefined): string {
  if (!htmlOrText) return "";
  const withoutTags = htmlOrText.replace(/<[^>]+>/g, " ");
  return withoutTags.replace(/\s+/g, " ").trim();
}

export function truncateSeoSnippet(text: string, maxLen = 120): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen).replace(/\s+\S*$/, "");
  return cut.endsWith(".") || cut.endsWith("…") ? cut : `${cut}...`;
}

export function buildBookSeoTitle(title: string): string {
  return `${title} ${SEO_BOOK_TITLE_SUFFIX}`;
}

export function buildBookMetaDescription(title: string, userDescription?: string | null): string {
  const snippet = truncateSeoSnippet(cleanUserDescription(userDescription), 120);
  const parts = [SEO_BOOK_DESCRIPTION_PREFIX(title)];
  if (snippet) parts.push(snippet);
  parts.push(SEO_BOOK_DESCRIPTION_SUFFIX);
  return parts.join(" ");
}

export function buildBookCanonicalUrl(slug: string): string {
  return `${SITE_URL}/books/${slug}/`;
}

export function buildBookCoverAlt(title: string): string {
  return `Обкладинка ранобе «${title}» — читати українською на FanVers`;
}

export function buildBookCardCoverAlt(title: string): string {
  const name = title.trim() || "книги";
  return `Обкладинка ранобе «${name}»`;
}
