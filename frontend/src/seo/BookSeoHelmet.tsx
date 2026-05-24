import { Helmet } from "react-helmet-async";
import {
  buildBookCanonicalUrl,
  buildBookMetaDescription,
  buildBookSeoTitle,
} from "./bookSeo";

type BookSeoHelmetProps = {
  title: string;
  slug: string;
  description?: string | null;
  coverImageUrl?: string | null;
};

export function BookSeoHelmet({ title, slug, description, coverImageUrl }: BookSeoHelmetProps) {
  const seoTitle = buildBookSeoTitle(title);
  const metaDescription = buildBookMetaDescription(title, description);
  const canonical = buildBookCanonicalUrl(slug);

  return (
    <Helmet>
      <html lang="uk" />
      <title>{seoTitle}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content="book" />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:url" content={canonical} />
      <meta property="og:locale" content="uk_UA" />
      {coverImageUrl ? <meta property="og:image" content={coverImageUrl} /> : null}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={metaDescription} />
    </Helmet>
  );
}
