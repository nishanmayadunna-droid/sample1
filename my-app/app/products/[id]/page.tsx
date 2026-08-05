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

  const specRows: [string, string][] = [
    ["Material", product.spec.material],
    ["Construction", product.spec.construction],
    ["Origin", product.spec.origin],
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-8 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
        <Link href="/products" className="hover:text-ink">
          Shop
        </Link>{" "}
        <span className="text-blaze">/</span>{" "}
        <Link
          href={`/products?category=${encodeURIComponent(product.category)}`}
          className="hover:text-ink"
        >
          {product.category}
        </Link>{" "}
        <span className="text-blaze">/</span>{" "}
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2 md:gap-12">
        <div className="overflow-hidden rounded-2xl border border-line md:sticky md:top-24 md:self-start">
          <ProductImage product={product} className="aspect-[4/5] w-full" />
        </div>

        <div>
          <span className="eyebrow text-muted">{product.category}</span>
          <h1 className="display mt-3 text-[clamp(2.25rem,6vw,3.75rem)]">
            {product.name}
          </h1>
          <p className="mt-3 font-mono text-lg">{formatPrice(product.price)}</p>

          <p className="mt-6 max-w-prose leading-relaxed text-muted">
            {product.description}
          </p>

          {/* Spec sheet */}
          <dl className="mt-8 border-t border-line">
            {specRows.map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-4 border-b border-line py-3"
              >
                <dt className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
                  {label}
                </dt>
                <dd className="font-mono text-sm">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8">
            <ProductPurchase product={product} />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <div className="measure text-ink mb-8" />
          <h2 className="display text-[clamp(1.5rem,3vw,2rem)]">
            More in {product.category}
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
