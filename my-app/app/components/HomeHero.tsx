import Link from "next/link";
import { formatPrice, type PricedProduct } from "@/lib/products";
import L from "./L";
import ProductImage from "./ProductImage";

/** The brand story, compact: shown on the home page when no promotion banner runs. */
export default function HomeHero({ hero }: { hero: PricedProduct | undefined }) {
  return (
    <section className="bg-panel text-panelink">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <span className="eyebrow rise text-panelmuted">
            <L si="Northbound — 64°N සිට" en="Est. Northbound — 64°N" />
          </span>
          <h1 className="display rise mt-4 text-[clamp(2.25rem,6vw,4rem)]" style={{ animationDelay: "80ms" }}>
            <L si="ඉවත දමන්න නොව," en="Made to be" />{" "}
            <span className="text-blaze">
              <L si="දිගු කලක්" en="worn out," />
            </span>{" "}
            <L si="අඳින්නට." en="not thrown out." />
          </h1>
          <p className="rise mt-4 max-w-md leading-relaxed text-panelmuted" style={{ animationDelay: "160ms" }}>
            <L
              si="අවංක රෙදි, සරල නිර්මාණ, සහ සමයට වඩා කල් පවතින උපාංග."
              en="Honest materials, quiet design, and hardware built to outlast the season."
            />
          </p>
          <Link
            href="/products"
            className="rise mt-6 inline-block rounded-full bg-blaze px-7 py-3 font-medium text-onaccent transition-transform hover:-translate-y-0.5"
            style={{ animationDelay: "240ms" }}
          >
            <L si="එකතුව බලන්න" en="Shop the collection" />
          </Link>
        </div>

        {hero && (
          <Link href={`/products/${hero.id}`} className="rise group hidden lg:block" style={{ animationDelay: "200ms" }}>
            <div className="overflow-hidden rounded-xl border border-white/15">
              <ProductImage
                product={hero}
                className="aspect-[16/10] w-full transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                sizes="(min-width: 1024px) 40vw, 100vw"
                preload
              />
              <div className="flex items-end justify-between gap-4 bg-black/25 px-4 py-3">
                <p className="font-medium">{hero.name}</p>
                <span className="font-mono">{formatPrice(hero.pricing.price)}</span>
              </div>
            </div>
          </Link>
        )}
      </div>
      <div className="measure text-panelink opacity-70" />
    </section>
  );
}
