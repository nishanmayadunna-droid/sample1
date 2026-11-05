"use client";

// Shared by the cart drawer and /cart, so both show the same money the same way.
import type { CartSummary } from "@/lib/cart-summary";
import type { Promotion } from "@/lib/promotions";
import { formatPrice } from "@/lib/products";
import L from "./L";

/** A promotion's name in both languages. */
export function PromoName({ promotion }: { promotion: Promotion }) {
  return <L si={promotion.nameSi} en={promotion.nameEn} />;
}

/**
 * Free-shipping progress: "✓ free shipping" once it applies, else how
 * much more is needed for the closest free-shipping rule; nothing when no
 * running promotion offers free shipping. A discount nudge follows, if any.
 */
export function CartProgress({ summary }: { summary: CartSummary<unknown> }) {
  const shipNudge = summary.nudges.find((n) => n.kind === "free_shipping");
  const dealNudge = summary.nudges.find((n) => n.kind !== "free_shipping");
  const free = summary.freeShippingBy;
  if (!free && !shipNudge && !dealNudge) return null;
  const progress = free
    ? 100
    : shipNudge
      ? Math.round(((shipNudge.target - shipNudge.missing) / shipNudge.target) * 100)
      : null;

  return (
    <div className="flex flex-col gap-2 text-sm">
      {free ? (
        <p className="text-blaze">
          ✓ <L si="ඔබට නොමිලේ බෙදාහැරීම ලැබේ" en="You've got free shipping" />
        </p>
      ) : (
        shipNudge && (
          <p>
            <L
              si={`නොමිලේ බෙදාහැරීමට තව ${formatPrice(shipNudge.missing)} ක් එක් කරන්න`}
              en={`Add ${formatPrice(shipNudge.missing)} more for free shipping`}
            />
          </p>
        )
      )}
      {progress !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-blaze" style={{ width: `${progress}%` }} />
        </div>
      )}
      {dealNudge && (
        <p className="text-muted">
          <PromoName promotion={dealNudge.promotion} />
          {": "}
          <L
            si={`වට්ටමට තව ${formatPrice(dealNudge.missing)} ක් එක් කරන්න`}
            en={`add ${formatPrice(dealNudge.missing)} more to get the discount`}
          />
        </p>
      )}
    </div>
  );
}

/** Subtotal, order discount, shipping and total rows. */
export function CartTotals({
  summary,
  shippingIsEstimate = true,
  className = "",
}: {
  summary: CartSummary<unknown>;
  /** False at checkout, where the fee is the final per-district one. */
  shippingIsEstimate?: boolean;
  className?: string;
}) {
  return (
    <dl className={`flex flex-col gap-2.5 font-mono text-sm ${className}`}>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">
          <L si="උප එකතුව" en="Subtotal" />
        </dt>
        <dd>{formatPrice(summary.subtotal)}</dd>
      </div>
      {summary.orderDiscount && (
        <div className="flex justify-between gap-4 text-blaze">
          <dt>
            <PromoName promotion={summary.orderDiscount.promotion} />
          </dt>
          <dd>−{formatPrice(summary.orderDiscount.amount)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <dt className="text-muted">
          {summary.shipping > 0 && shippingIsEstimate ? (
            <L
              si="බෙදාහැරීම (ඇස්තමේන්තුව, checkout හිදී දිස්ත්‍රික්කය අනුව තීරණය වේ)"
              en="Shipping (estimate, set by district at checkout)"
            />
          ) : (
            <L si="බෙදාහැරීම" en="Shipping" />
          )}
        </dt>
        <dd className="text-right">
          {summary.shipping > 0 ? formatPrice(summary.shipping) : <L si="නොමිලේ" en="Free" />}
        </dd>
      </div>
      <div className="mt-1 flex justify-between gap-4 border-t border-line pt-3 text-base">
        <dt>
          <L si="මුළු එකතුව" en="Total" />
        </dt>
        <dd>{formatPrice(summary.total)}</dd>
      </div>
    </dl>
  );
}

/** A line's unit price, struck list price and promotion name. */
export function LinePrice({
  unitPrice,
  compareAt,
  promotion,
}: {
  unitPrice: number;
  compareAt: number | null;
  promotion: Promotion | null;
}) {
  return (
    <span className="font-mono text-[0.7rem] text-muted">
      {formatPrice(unitPrice)}
      {compareAt != null && <span className="ml-1.5 line-through">{formatPrice(compareAt)}</span>}
      {promotion && (
        <span className="ml-1.5 text-blaze">
          · <PromoName promotion={promotion} />
        </span>
      )}
    </span>
  );
}
