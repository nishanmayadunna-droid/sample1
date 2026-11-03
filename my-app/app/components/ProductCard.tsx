import Link from "next/link";
import { formatPrice, formatPriceWhole, type PricedProduct } from "@/lib/products";
import type { ConditionalOffer } from "@/lib/promotions";
import L from "./L";
import ProductImage from "./ProductImage";

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

export default function ProductCard({ product }: { product: PricedProduct }) {
  const { pricing } = product;
  const offer = pricing.conditional[0];

  return (
    <Link href={`/products/${product.id}`} className="group flex flex-col">
      <div className="relative overflow-hidden rounded-[10px] border border-line bg-surface">
        <ProductImage
          product={product}
          className="aspect-[4/5] w-full transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        {pricing.discountPercent != null && (
          <span className="absolute right-3 top-3 flex flex-col items-end gap-1">
            <span className="rounded bg-blaze px-1.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-widest text-white">
              −{pricing.discountPercent}%
            </span>
            {pricing.promotion && (
              <span className="max-w-32 truncate rounded bg-panel px-1.5 py-0.5 text-[0.65rem] text-panelink">
                <L si={pricing.promotion.nameSi} en={pricing.promotion.nameEn} />
              </span>
            )}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 pt-3">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted">
          {product.spec.construction} · {product.spec.origin}
        </span>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="font-medium leading-snug decoration-blaze decoration-2 underline-offset-4 group-hover:underline">
            {product.name}
          </h3>
          {pricing.compareAt != null ? (
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-sm text-blaze">{formatPrice(pricing.price)}</span>
              <span className="font-mono text-xs text-muted line-through">
                {formatPrice(pricing.compareAt)}
              </span>
            </span>
          ) : (
            <span className="shrink-0 font-mono text-sm">{formatPrice(pricing.price)}</span>
          )}
        </div>
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
    </Link>
  );
}
