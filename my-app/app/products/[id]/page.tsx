import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatPrice,
  getAllProducts,
  getProduct,
  getProductsByCategory,
} from "@/lib/products";
import ProductImage from "../../components/ProductImage";
import ProductCard from "../../components/ProductCard";
import ProductPurchase from "../../components/ProductPurchase";

// Pre-render every product page at build time.
export function generateStaticParams() {
  return getAllProducts().map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = getProduct(id);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProduct(id);
  if (!product) notFound();

  const related = getProductsByCategory(product.category)
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/products" className="hover:underline">
          Shop
        </Link>{" "}
        /{" "}
        <Link
          href={`/products?category=${encodeURIComponent(product.category)}`}
          className="hover:underline"
        >
          {product.category}
        </Link>{" "}
        / <span className="text-zinc-700 dark:text-zinc-200">{product.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <ProductImage
          product={product}
          className="aspect-[4/5] w-full rounded-2xl"
        />

        <div className="flex flex-col gap-6">
          <div>
            <span className="text-sm uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {product.category}
            </span>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {product.name}
            </h1>
            <p className="mt-2 text-2xl font-semibold">
              {formatPrice(product.price)}
            </p>
          </div>

          <p className="text-zinc-600 dark:text-zinc-300">
            {product.description}
          </p>

          <ProductPurchase product={product} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">
            More in {product.category}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
