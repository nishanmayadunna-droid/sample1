import Link from "next/link";
import {
  CATEGORIES,
  formatPrice,
  getFeaturedProducts,
  getProduct,
  getProductsByCategory,
  getSaleProducts,
} from "@/lib/products";
import ProductCard from "./components/ProductCard";
import ProductImage from "./components/ProductImage";
import FlashCountdown from "./components/FlashCountdown";
import Newsletter from "./components/Newsletter";

// Representative gradient per category for the shop-by-category tiles.
const CATEGORY_SWATCH: Record<string, [string, string]> = {
  Tops: ["#1e293b", "#0f172a"],
  Bottoms: ["#3b82f6", "#1e3a8a"],
  Outerwear: ["#4d7c0f", "#365314"],
  Accessories: ["#d97706", "#78350f"],
};

const PROMISES: [string, string][] = [
  ["Free shipping", "On orders over $75"],
  ["30-day returns", "No restocking fees"],
  ["Built to be repaired", "Free repairs for a year"],
  ["Carbon-neutral", "Every order offset"],
];

export default function Home() {
  const featured = getFeaturedProducts();
  const sale = getSaleProducts();
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

      {/* SHOP BY CATEGORY */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="eyebrow text-muted">Find your kit</span>
            <h2 className="display mt-2 text-[clamp(1.75rem,4vw,2.75rem)]">
              Shop by category
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {CATEGORIES.map((category) => {
            const [from, to] = CATEGORY_SWATCH[category];
            const count = getProductsByCategory(category).length;
            return (
              <Link
                key={category}
                href={`/products?category=${encodeURIComponent(category)}`}
                className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-xl border border-line p-5 text-white"
                style={{ background: `linear-gradient(150deg, ${from}, ${to})` }}
              >
                <span className="pointer-events-none absolute inset-0 bg-black/15 transition-colors group-hover:bg-black/0" />
                <span className="relative font-mono text-[0.6rem] uppercase tracking-widest text-white/80">
                  {String(count).padStart(2, "0")} styles
                </span>
                <span className="display relative mt-1 text-2xl leading-none">
                  {category}
                </span>
                <span className="relative mt-2 font-mono text-xs text-white/80">
                  Shop →
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* FLASH SALE */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-4 sm:px-6">
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <div className="flex flex-col gap-6 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="eyebrow text-blaze">Ends tonight</span>
              <h2 className="display mt-2 text-[clamp(1.75rem,4vw,2.75rem)]">
                Flash sale
              </h2>
              <p className="mt-1 max-w-md text-sm text-muted">
                Limited stock on select field kit. When it&apos;s gone,
                it&apos;s gone.
              </p>
            </div>
            <div>
              <span className="eyebrow mb-2 text-muted">Time left</span>
              <FlashCountdown />
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {sale.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
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

      {/* THE PROMISE — value props in the spec voice, split by hairline rules. */}
      <section className="border-y border-line">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-px bg-line md:grid-cols-4">
          {PROMISES.map(([label, detail]) => (
            <div key={label} className="bg-bg px-5 py-8 sm:px-6">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em]">
                {label}
              </p>
              <p className="mt-2 text-sm text-muted">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* NEWSLETTER */}
      <Newsletter />
    </div>
  );
}
