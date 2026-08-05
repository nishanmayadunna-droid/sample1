import Link from "next/link";
import { formatPrice, getFeaturedProducts, getProduct } from "@/lib/products";
import ProductCard from "./components/ProductCard";
import ProductImage from "./components/ProductImage";

export default function Home() {
  const featured = getFeaturedProducts();
  const hero = getProduct("field-jacket")!;

  return (
    <div>
      {/* HERO — the durability thesis, set on a spruce field panel. */}
      <section className="bg-panel text-panelink">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="eyebrow rise text-panelmuted">
              Est. Northbound — 64°N
            </span>
            <h1 className="display mt-6 text-[clamp(2.75rem,8vw,5.5rem)]">
              <span className="rise block" style={{ animationDelay: "80ms" }}>
                Made to be
              </span>
              <span
                className="rise block text-blaze"
                style={{ animationDelay: "160ms" }}
              >
                worn out,
              </span>
              <span className="rise block" style={{ animationDelay: "240ms" }}>
                not thrown out.
              </span>
            </h1>
            <p
              className="rise mt-7 max-w-md text-lg leading-relaxed text-panelmuted"
              style={{ animationDelay: "340ms" }}
            >
              Honest materials, quiet design, and hardware built to outlast the
              season. Layers and outerwear for the cold miles ahead.
            </p>
            <div
              className="rise mt-8 flex flex-wrap items-center gap-5"
              style={{ animationDelay: "420ms" }}
            >
              <Link
                href="/products"
                className="rounded-full bg-blaze px-7 py-3.5 font-medium text-white transition-transform hover:-translate-y-0.5"
              >
                Shop the collection
              </Link>
              <Link
                href="/products?category=Outerwear"
                className="font-mono text-xs uppercase tracking-[0.16em] underline-offset-4 hover:underline"
              >
                Shop outerwear →
              </Link>
            </div>
          </div>

          {/* Field-tag feature — a hangtag for one hero product. */}
          <Link
            href={`/products/${hero.id}`}
            className="rise group block"
            style={{ animationDelay: "300ms" }}
          >
            <div className="overflow-hidden rounded-xl border border-white/15">
              <ProductImage
                product={hero}
                className="aspect-[4/3] w-full transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
              <div className="flex items-end justify-between gap-4 bg-black/25 p-5">
                <div>
                  <span className="eyebrow text-panelmuted">Field tested</span>
                  <p className="mt-1.5 font-medium">{hero.name}</p>
                  <p className="mt-1 font-mono text-xs text-panelmuted">
                    {hero.spec.material} · {hero.spec.origin}
                  </p>
                </div>
                <span className="font-mono">{formatPrice(hero.price)}</span>
              </div>
            </div>
          </Link>
        </div>
        <div className="measure text-panelink opacity-70" />
      </section>

      {/* FEATURED */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <span className="eyebrow text-muted">Selected</span>
            <h2 className="display mt-2 text-[clamp(1.75rem,4vw,2.75rem)]">
              Field favourites
            </h2>
          </div>
          <Link
            href="/products"
            className="font-mono text-xs uppercase tracking-[0.16em] text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            All products →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
