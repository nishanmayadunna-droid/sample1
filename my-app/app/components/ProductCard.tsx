import Link from "next/link";
import { savedAmount } from "@/lib/home-sections";
import { formatPrice, formatPriceWhole, type PricedProduct } from "@/lib/products";
import type { ConditionalOffer } from "@/lib/promotions";
import L from "./L";
import ProductImage from "./ProductImage";
import Stars from "./Stars";
import QuickAdd from "./QuickAdd";
import { allSoldOut } from "@/lib/stock";

/** "Rs 10,000+ orders: 20% off" for a promotion rule with a minimum. */
export function ConditionalOfferText({ offer }: { offer: ConditionalOffer }) {
  const { rule } = offer;
  const min = formatPriceWhole(rule.minSubtotal);
  const off = rule.kind === "percent_off" ? `${rule.value}%` : formatPriceWhole(rule.value);
  return (
    <L
      si={`${min}+ ඇණවුම්වලට ${off} අඩුවෙන්`}
      en={`${off} off on orders over ${min}`}
    />
  );
}

/**
 * A product in a grid or row. An <article> rather than one big link, so the
 * quick-add button isn't nested inside a link.
 */
export default function ProductCard({
  product,
  sizes = "(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw",
}: {
  product: PricedProduct;
  /** Rendered width hint for the photo; match it to the slot. */
  sizes?: string;
}) {
  const { pricing } = product;
  const saved = savedAmount(pricing);
  const offer = pricing.conditional[0];
  const href = `/products/${product.id}`;

  return (
    <article className="group flex flex-col">
      <div className="relative overflow-hidden rounded-[10px] border border-line bg-surface">
        <Link href={href} tabIndex={-1} aria-hidden="true">
          <ProductImage
            showCategory={false}
            product={product}
            className="aspect-[4/5] w-full transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            sizes={sizes}
          />
        </Link>
        {pricing.discountPercent != null && (
          <span className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1">
            <span className="rounded bg-blaze px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-white">
              −{pricing.discountPercent}%
            </span>
            {pricing.promotion && (
              <span className="max-w-28 truncate rounded bg-panel px-1.5 py-0.5 text-[0.65rem] text-panelink">
                <L si={pricing.promotion.nameSi} en={pricing.promotion.nameEn} />
              </span>
            )}
          </span>
        )}
        {allSoldOut(product) && (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-panel px-1.5 py-0.5 font-mono text-[0.65rem] text-panelink">
            <L si="අවසන්" en="Sold out" />
          </span>
        )}
        <QuickAdd productId={product.id} name={product.name} sizes={product.sizes} stock={product.stock} />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 pt-2">
        <Link
          href={href}
          className="line-clamp-2 text-sm leading-snug decoration-blaze decoration-2 underline-offset-4 hover:underline"
        >
          {product.name}
        </Link>
        {product.rating && (
          <p className="flex items-center gap-1.5 font-mono text-xs text-muted">
            <Stars value={product.rating.average} className="text-xs" />
            <span>
              {product.rating.average.toFixed(1)} ({product.rating.count})
            </span>
          </p>
        )}
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className={`font-mono text-base font-semibold ${saved ? "text-blaze" : ""}`}>
            {formatPrice(pricing.price)}
          </span>
          {pricing.compareAt != null && (
            <span className="font-mono text-xs text-muted line-through">{formatPrice(pricing.compareAt)}</span>
          )}
        </p>
        {saved != null && (
          <span className="text-xs text-blaze">
            <L si={`${formatPrice(saved)} ඉතුරුයි`} en={`Save ${formatPrice(saved)}`} />
          </span>
        )}
        {pricing.freeShipping && (
          <span className="text-xs text-blaze">
            🚚 <L si="නොමිලේ බෙදාහැරීම" en="Free shipping" />
          </span>
        )}
        {offer && (
          <span className="text-xs text-muted">
            <ConditionalOfferText offer={offer} />
          </span>
        )}
      </div>
    </article>
  );
}
