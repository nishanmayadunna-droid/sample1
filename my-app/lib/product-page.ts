// Pure rules for the product page's delivery and offer chips. Every chip is
// real data (a running promotion or the admin's shipping fee).
import { formatPriceWhole } from "./products";
import type { ItemPricing } from "./promotions";

export type DeliveryChip = { key: string; si: string; en: string };

function colomboDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { timeZone: "Asia/Colombo", day: "numeric", month: "long" });
}

export function deliveryChips(
  pricing: ItemPricing,
  /** The admin's default shipping fee, in cents (only whether it is above zero matters here). */
  shippingFee: number,
  /** When the promotion behind the price ends, if it does. */
  endsAt: Date | null,
): DeliveryChip[] {
  const chips: DeliveryChip[] = [];

  if (pricing.freeShipping) {
    chips.push({ key: "free-shipping", si: "නොමිලේ බෙදාහැරීම", en: "Free shipping" });
  } else if (shippingFee > 0) {
    // The fee is set per district at checkout, so no single amount is stated here.
    chips.push({
      key: "shipping",
      si: "බෙදාහැරීමේ ගාස්තුව ඔබේ දිස්ත්‍රික්කය අනුව වේ, checkout හිදී පෙන්වයි",
      en: "Delivery fee depends on your district, shown at checkout",
    });
  }

  for (const { promotion, rule } of pricing.conditional) {
    const min = formatPriceWhole(rule.minSubtotal);
    const off = rule.kind === "percent_off" ? `${rule.value}%` : formatPriceWhole(rule.value);
    chips.push({
      key: `offer-${promotion.slug}`,
      si: `${promotion.nameSi}: ${min}+ ඇණවුම්වලට ${off} අඩුවෙන්`,
      en: `${promotion.nameEn}: ${off} off on orders over ${min}`,
    });
  }

  if (endsAt) {
    chips.push({
      key: "ends",
      si: `${colomboDate(endsAt, "si-LK")} දක්වා`,
      en: `Until ${colomboDate(endsAt, "en-LK")}`,
    });
  }
  return chips;
}
