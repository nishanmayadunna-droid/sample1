import Link from "next/link";
import { getFeaturedProducts } from "@/lib/products";
import ProductCard from "./components/ProductCard";

export default function Home() {
  const featured = getFeaturedProducts();

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-black/[.08] bg-zinc-50 dark:border-white/[.12] dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-24 sm:px-6 sm:py-32">
          <span className="text-sm font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            New season
          </span>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Considered clothing, built to be worn hard and kept for years.
          </h1>
          <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-300">
            Honest materials and quiet design — tops, bottoms, outerwear, and
            the accessories that finish the fit.
          </p>
          <Link
            href="/products"
            className="rounded-full bg-foreground px-7 py-3 font-medium text-background transition-opacity hover:opacity-90"
          >
            Shop the collection
          </Link>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Featured</h2>
          <Link
            href="/products"
            className="text-sm font-medium underline underline-offset-4"
          >
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
