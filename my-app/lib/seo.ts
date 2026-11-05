/** JSON for a <script type="application/ld+json"> body; safe against early tag close. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(String.fromCharCode(0x2028)).join("\\u2028")
    .split(String.fromCharCode(0x2029)).join("\\u2029");
}

export function productJsonLd(input: {
  name: string;
  description: string;
  url: string;
  images: string[];
  price: number; // cents
  inStock: boolean;
  rating: { average: number; count: number } | null;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    url: input.url,
  };
  if (input.description.trim() !== "") out.description = input.description;
  if (Number.isFinite(input.price) && input.price >= 0) {
    out.offers = {
      "@type": "Offer",
      url: input.url,
      price: (Math.round(input.price) / 100).toFixed(2),
      priceCurrency: "LKR",
      availability: input.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    };
  }
  if (input.images.length > 0) out.image = input.images;
  if (input.rating) {
    out.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: input.rating.average,
      reviewCount: input.rating.count,
    };
  }
  return out;
}

export function organizationJsonLd(input: {
  name: string;
  url: string;
  logo?: string;
  phone?: string;
  email?: string;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: input.url,
  };
  if (input.logo) out.logo = input.logo;
  if (input.phone) out.telephone = input.phone;
  if (input.email) out.email = input.email;
  return out;
}

export function websiteJsonLd(input: { name: string; url: string }): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    url: input.url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${input.url}/products?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export type RobotsRule = { userAgent: string; allow?: string[]; disallow?: string[] };

export function robotsRules(input: {
  production: boolean;
  base: string;
}): { rules: RobotsRule[]; sitemap?: string } {
  if (!input.production) {
    return { rules: [{ userAgent: "*", disallow: ["/"] }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/admin", "/account", "/checkout", "/cart", "/orders", "/signin", "/unsubscribe", "/api"],
      },
    ],
    sitemap: `${input.base}/sitemap.xml`,
  };
}

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency?: "daily" | "weekly" | "monthly";
  priority?: number;
};

const STORE_PAGES = ["about", "contact", "privacy", "terms", "returns", "size-guide"];

export function sitemapEntries(input: {
  base: string;
  productIds: string[];
  now?: Date;
}): SitemapEntry[] {
  const { base, now } = input;
  const entries: SitemapEntry[] = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...STORE_PAGES.map((p) => ({
      url: `${base}/${p}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
  const seen = new Set(entries.map((e) => e.url));
  for (const id of input.productIds) {
    const url = `${base}/products/${encodeURIComponent(id)}`;
    if (seen.has(url)) continue;
    seen.add(url);
    entries.push({ url, lastModified: now, changeFrequency: "weekly", priority: 0.7 });
  }
  return entries;
}
