import type { Metadata } from "next";
import Link from "next/link";
import { getAllProducts, getCategories } from "@/lib/catalog";
import { withPricing } from "@/lib/promotions";
import { getRunningPromotions } from "@/lib/storefront";
import { resolveCategoryParam } from "@/lib/category-form";
import { filterProducts, parseView, type ProductView } from "@/lib/product-filters";
import ProductGrid from "../components/ProductGrid";
import L from "../components/L";
import PromoBanner from "../components/PromoBanner";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Params>;
}): Promise<Metadata> {
  const params = await searchParams;
  const filtered = (["category", "view", "q", "promo"] as const).some((k) => params[k]);
  return {
    title: "Shop all",
    description: "Browse the full Northbound collection.",
    alternates: { canonical: "/products" },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

const VIEW_TITLES: Record<ProductView, { si: string; en: string }> = {
  deals: { si: "⚡ Flash Deals", en: "⚡ Flash Deals" },
  picks: { si: "⭐ තෝරාගත් භාණ්ඩ", en: "⭐ Top Picks" },
  new: { si: "🆕 අලුතින් ආ", en: "🆕 New In" },
};

type Params = { q?: string; category?: string; view?: string; promo?: string };

/** /products with the current filters minus one, for a chip's ✕ link. */
function hrefWithout(params: Params, drop: keyof Params): string {
  const next = new URLSearchParams();
  for (const key of ["promo", "view", "category", "q"] as const) {
    const value = params[key];
    if (key !== drop && value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `/products?${query}` : "/products";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const [catalog, categories, promotions] = await Promise.all([
    getAllProducts(),
    getCategories(),
    getRunningPromotions(),
  ]);
  const allProducts = withPricing(catalog, promotions, categories);
  // Accepts the slug or the name in any case, so old ?category=Outerwear links work.
  const active = resolveCategoryParam(params.category, categories);
  const view = parseView(params.view);
  const q = params.q?.trim() ?? "";
  // Only a running promotion counts; an unknown or finished one shows everything.
  const promo = promotions.find((p) => p.slug === params.promo) ?? null;
  const products = filterProducts(allProducts, { q, category: active, view, promo }, categories);

  // Only the filters that actually apply get a chip.
  const chips: { key: keyof Params; label: React.ReactNode }[] = [];
  if (promo) chips.push({ key: "promo", label: <L si={promo.nameSi} en={promo.nameEn} /> });
  if (view) chips.push({ key: "view", label: <L {...VIEW_TITLES[view]} /> });
  if (active) chips.push({ key: "category", label: active.name });
  if (q) chips.push({ key: "q", label: `“${q}”` });
  // Category pills keep the other filters.
  const categoryHref = (slug: string | null) => {
    const next = new URLSearchParams();
    if (promo) next.set("promo", promo.slug);
    if (view) next.set("view", view);
    if (slug) next.set("category", slug);
    if (q) next.set("q", q);
    const query = next.toString();
    return query ? `/products?${query}` : "/products";
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      {promo && promo.banner.mode !== "none" && (
        <div className="mb-10">
          <PromoBanner promotion={promo} preload />
        </div>
      )}
      <header>
        <span className="eyebrow text-muted">
          <L si="එකතුව" en="The collection" />
        </span>
        <h1 className="display mt-2 text-[clamp(2rem,5vw,3.25rem)]">
          {view ? (
            <L {...VIEW_TITLES[view]} />
          ) : promo ? (
            <L si={promo.nameSi} en={promo.nameEn} />
          ) : (
            (active?.name ?? <L si="සියලු භාණ්ඩ" en="All products" />)
          )}
        </h1>
        <p className="mt-2 font-mono text-xs text-muted">
          {String(products.length).padStart(2, "0")} <L si="භාණ්ඩ" en="items" />
        </p>
        {chips.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li key={chip.key}>
                <Link
                  href={hrefWithout(params, chip.key)}
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-sm text-bg transition-opacity hover:opacity-80"
                >
                  {chip.label}
                  <span aria-hidden="true">✕</span>
                  <span className="sr-only">
                    <L si="ඉවත් කරන්න" en="Remove filter" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>

      <div className="measure text-ink my-8" />

      {/* Category filter */}
      <nav className="mb-10 flex flex-wrap gap-2">
        <FilterPill
          href={categoryHref(null)}
          label={<L si="සියල්ල" en="All" />}
          active={!active}
        />
        {categories.map((c) => (
          <FilterPill
            key={c.slug}
            href={categoryHref(c.slug)}
            label={c.name}
            active={active?.slug === c.slug}
          />
        ))}
      </nav>

      {products.length === 0 ? (
        <div className="flex flex-col items-start gap-4 py-12">
          <p className="display text-3xl">
            <L si="ගැළපෙන භාණ්ඩ නැහැ" en="No products match" />
          </p>
          <Link
            href="/products"
            className="rounded-full bg-blaze px-6 py-3 font-medium text-onaccent transition-transform hover:-translate-y-0.5"
          >
            <L si="පෙරහන් ඉවත් කරන්න" en="Clear filters" />
          </Link>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}

function FilterPill({
  href,
  label,
  active,
}: {
  href: string;
  label: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] transition-colors ${
        active
          ? "border-blaze bg-blaze text-white"
          : "border-line text-muted hover:border-ink hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
