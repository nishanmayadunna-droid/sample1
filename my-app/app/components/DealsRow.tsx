import Link from "next/link";
import type { PricedProduct } from "@/lib/products";
import FlashCountdown from "./FlashCountdown";
import L from "./L";
import ProductCard from "./ProductCard";

/**
 * ⚡ Flash Deals: discounted products in a sideways-scrolling row. The
 * countdown shows only when a promotion behind these deals has a real end.
 */
export default function DealsRow({ deals, endsAt }: { deals: PricedProduct[]; endsAt: string | null }) {
  if (deals.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="display text-[clamp(1.5rem,4vw,2.25rem)] text-blaze">⚡ Flash Deals</h2>
          {endsAt && <FlashCountdown endsAt={endsAt} />}
        </div>
        <Link
          href="/products?view=deals"
          className="font-mono text-xs uppercase tracking-[0.16em] text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          <L si="සියලු deals →" en="All deals →" />
        </Link>
      </div>
      <ul className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {deals.map((product) => (
          <li key={product.id} className="w-40 shrink-0 snap-start sm:w-48">
            <ProductCard product={product} sizes="192px" />
          </li>
        ))}
      </ul>
    </section>
  );
}
