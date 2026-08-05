import type { Metadata } from "next";
import Link from "next/link";
import {
  CATEGORIES,
  getAllProducts,
  getProductsByCategory,
  type Category,
} from "@/lib/products";
import ProductCard from "../components/ProductCard";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Browse the full Northbound collection.",
};

function isCategory(value: string | undefined): value is Category {
  return !!value && (CATEGORIES as string[]).includes(value);
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const active = isCategory(category) ? category : null;
  const products = active ? getProductsByCategory(active) : getAllProducts();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header>
        <span className="eyebrow text-muted">The collection</span>
        <h1 className="display mt-2 text-[clamp(2rem,5vw,3.25rem)]">
          {active ?? "All products"}
        </h1>
        <p className="mt-2 font-mono text-xs text-muted">
          {String(products.length).padStart(2, "0")} items in stock
        </p>
      </header>

      <div className="measure text-ink my-8" />

      {/* Category filter */}
      <nav className="mb-10 flex flex-wrap gap-2">
        <FilterPill href="/products" label="All" active={!active} />
        {CATEGORIES.map((c) => (
          <FilterPill
            key={c}
            href={`/products?category=${encodeURIComponent(c)}`}
            label={c}
            active={active === c}
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
  label: string;
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
