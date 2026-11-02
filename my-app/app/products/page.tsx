import type { Metadata } from "next";
import Link from "next/link";
import { getAllProducts, getCategories, getProductsByCategory } from "@/lib/catalog";
import { resolveCategoryParam } from "@/lib/category-form";
import ProductCard from "../components/ProductCard";
import L from "../components/L";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Browse the full Northbound collection.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const categories = await getCategories();
  // Accepts the slug or the name in any case, so old ?category=Outerwear links work.
  const active = resolveCategoryParam(category, categories);
  const products = active
    ? await getProductsByCategory(active)
    : await getAllProducts();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header>
        <span className="eyebrow text-muted">
          <L si="එකතුව" en="The collection" />
        </span>
        <h1 className="display mt-2 text-[clamp(2rem,5vw,3.25rem)]">
          {active?.name ?? <L si="සියලු භාණ්ඩ" en="All products" />}
        </h1>
        <p className="mt-2 font-mono text-xs text-muted">
          {String(products.length).padStart(2, "0")} <L si="භාණ්ඩ" en="items" />
        </p>
      </header>

      <div className="measure text-ink my-8" />

      {/* Category filter */}
      <nav className="mb-10 flex flex-wrap gap-2">
        <FilterPill href="/products" label={<L si="සියල්ල" en="All" />} active={!active} />
        {categories.map((c) => (
          <FilterPill
            key={c.slug}
            href={`/products?category=${encodeURIComponent(c.slug)}`}
            label={c.name}
            active={active?.slug === c.slug}
          />
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
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
