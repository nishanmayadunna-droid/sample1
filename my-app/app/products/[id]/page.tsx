import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/products";
import { withPricing } from "@/lib/promotions";
import { getRunningPromotions } from "@/lib/storefront";
import { ConditionalOfferText } from "../../components/ProductCard";
import { getAllProducts, getCategories, getProduct, getProductsByCategory } from "@/lib/catalog";
import { resolveCategoryParam } from "@/lib/category-form";
import ProductImage from "../../components/ProductImage";
import L from "../../components/L";
import ProductGrid from "../../components/ProductGrid";
import ProductPurchase from "../../components/ProductPurchase";

// Re-fetch catalog data from Supabase at most once a minute (ISR).
export const revalidate = 60;

// Pre-render every product page at build time; new products render on demand.
export async function generateStaticParams() {
  return (await getAllProducts()).map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
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
  const product = await getProduct(id);
  if (!product) notFound();

  const [categories, promotions] = await Promise.all([getCategories(), getRunningPromotions()]);
  const [{ pricing }] = withPricing([product], promotions, categories);
  // Accepts a slug or an old display name.
  const category = resolveCategoryParam(product.category, categories);
  const categorySlug = category?.slug ?? product.category;
  const related = withPricing(
    (category ? await getProductsByCategory(category) : [])
      .filter((p) => p.id !== product.id)
      .slice(0, 4),
    promotions,
    categories,
  );
  const endsAt = pricing.promotion?.endsAt ? new Date(pricing.promotion.endsAt) : null;
  const endDate = (locale: string) =>
    endsAt?.toLocaleDateString(locale, { timeZone: "Asia/Colombo", day: "numeric", month: "long" }) ?? "";

  const specRows: { key: string; label: React.ReactNode; value: string }[] = [
    { key: "material", label: <L si="රෙදි වර්ගය" en="Material" />, value: product.spec.material },
    { key: "construction", label: <L si="නිර්මාණය" en="Construction" />, value: product.spec.construction },
    { key: "origin", label: <L si="නිෂ්පාදිත රට" en="Origin" />, value: product.spec.origin },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-8 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
        <Link href="/products" className="hover:text-ink">
          <L si="සාප්පුව" en="Shop" />
        </Link>{" "}
        <span className="text-blaze">/</span>{" "}
        <Link
          href={`/products?category=${encodeURIComponent(categorySlug)}`}
          className="hover:text-ink"
        >
          {product.categoryName}
        </Link>{" "}
        <span className="text-blaze">/</span>{" "}
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2 md:gap-12">
        <div className="overflow-hidden rounded-2xl border border-line md:sticky md:top-24 md:self-start">
          <ProductImage
            product={product}
            className="aspect-[4/5] w-full"
            sizes="(min-width: 768px) 50vw, 100vw"
            preload
          />
        </div>

        <div>
          <span className="eyebrow text-muted">{product.categoryName}</span>
          <h1 className="display mt-3 text-[clamp(2.25rem,6vw,3.75rem)]">
            {product.name}
          </h1>
          {pricing.compareAt != null ? (
            <p className="mt-3 flex flex-wrap items-center gap-3 font-mono text-lg">
              <span className="text-blaze">{formatPrice(pricing.price)}</span>
              <span className="text-base text-muted line-through">
                {formatPrice(pricing.compareAt)}
              </span>
              <span className="rounded bg-blaze px-1.5 py-0.5 text-xs font-medium text-white">
                −{pricing.discountPercent}%{" "}
                {pricing.promotion ? (
                  <L si={pricing.promotion.nameSi} en={pricing.promotion.nameEn} />
                ) : (
                  <L si="අඩු මිල" en="flash sale" />
                )}
              </span>
            </p>
          ) : (
            <p className="mt-3 font-mono text-lg">{formatPrice(pricing.price)}</p>
          )}
          {endsAt && (
            <p className="mt-2 text-sm text-muted">
              <L si={`${endDate("si-LK")} දක්වා`} en={`Until ${endDate("en-LK")}`} />
            </p>
          )}
          {pricing.freeShipping && (
            <p className="mt-2 text-sm text-blaze">
              🚚 <L si="නොමිලේ බෙදාහැරීම" en="Free shipping" />
            </p>
          )}
          {pricing.conditional.map((offer, i) => (
            <p key={i} className="mt-1 text-sm text-muted">
              <L si={offer.promotion.nameSi} en={offer.promotion.nameEn} />: <ConditionalOfferText offer={offer} />
            </p>
          ))}

          <p className="mt-6 max-w-prose leading-relaxed text-muted">
            {product.description}
          </p>

          {/* Spec sheet */}
          <dl className="mt-8 border-t border-line">
            {specRows.map(({ key, label, value }) => (
              <div
                key={key}
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
            <L si={`${product.categoryName} තවත්`} en={`More in ${product.categoryName}`} />
          </h2>
          <div className="mt-8">
            <ProductGrid products={related} />
          </div>
        </section>
      )}
    </div>
  );
}
