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
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          {active ?? "All products"}
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-300">
          {products.length} item{products.length === 1 ? "" : "s"}
        </p>
      </header>

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

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
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
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-black/[.15] hover:border-foreground dark:border-white/[.2]"
      }`}
    >
      {label}
    </Link>
  );
}
