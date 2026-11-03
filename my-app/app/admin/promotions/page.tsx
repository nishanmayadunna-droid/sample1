import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { listPromotionsForAdmin } from "@/lib/admin-promotions";
import { formatPriceWhole } from "@/lib/products";
import { promotionStatus, type PromotionRule } from "@/lib/promotions";
import AdminTabs from "../AdminTabs";
import { getPickers } from "./pickers";

export const metadata: Metadata = { title: "Admin" };

const STATUS = {
  running: { label: "🟢 Running", className: "text-blaze" },
  scheduled: { label: "🕒 Scheduled", className: "text-ink" },
  ended: { label: "⚪ Ended", className: "text-muted" },
  off: { label: "⏸ Off", className: "text-muted" },
} as const;

const colombo = (iso: string) =>
  new Date(iso).toLocaleString("en-LK", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function ruleSummary(rule: PromotionRule, categoryNames: Map<string, string>): string {
  const what =
    rule.kind === "free_shipping"
      ? "Free shipping"
      : rule.kind === "percent_off"
        ? `${rule.value}% off`
        : rule.kind === "amount_off_item"
          ? `${formatPriceWhole(rule.value)} off each`
          : `${formatPriceWhole(rule.value)} off the order`;
  const scope =
    rule.scope === "all"
      ? "everything"
      : rule.scope === "categories"
        ? rule.categorySlugs.map((s) => categoryNames.get(s) ?? s).join(", ")
        : `${rule.productIds.length} product${rule.productIds.length === 1 ? "" : "s"}`;
  const min = rule.minSubtotal > 0 ? ` over ${formatPriceWhole(rule.minSubtotal)}` : "";
  return `${what} · ${scope}${min}`;
}

export default async function AdminPromotionsPage() {
  await requireAdmin("/admin/promotions");
  const [promotions, { categories, products }] = await Promise.all([listPromotionsForAdmin(), getPickers()]);
  const categoryNames = new Map(categories.map((c) => [c.slug, c.name]));
  const productIds = new Set(products.map((p) => p.id));
  const now = new Date();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="promotions" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted">Staff only</p>
          <h1 className="display mt-2 text-5xl">Promotions</h1>
        </div>
        <Link
          href="/admin/promotions/new"
          className="rounded-full bg-blaze px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5"
        >
          New promotion
        </Link>
      </div>
      <div className="measure mt-6 text-ink" />

      {promotions.length === 0 ? (
        <p className="mt-8 text-muted">No promotions yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {promotions.map((promotion) => {
            const status = STATUS[promotionStatus(promotion, now)];
            const missing = promotion.rules.some(
              (r) =>
                (r.scope === "categories" && r.categorySlugs.some((s) => !categoryNames.has(s))) ||
                (r.scope === "products" && r.productIds.some((id) => !productIds.has(id))),
            );
            return (
              <li key={promotion.id} className="flex flex-wrap items-start justify-between gap-4 py-5">
                <div className="min-w-60 flex-1">
                  <Link href={`/admin/promotions/${promotion.id}`} className="font-medium hover:underline">
                    {promotion.nameEn || promotion.nameSi}
                  </Link>
                  {promotion.nameSi && promotion.nameEn && (
                    <span className="ml-2 text-sm text-muted">{promotion.nameSi}</span>
                  )}
                  <p className="mt-1 font-mono text-xs text-muted">
                    {colombo(promotion.startsAt)} → {promotion.endsAt ? colombo(promotion.endsAt) : "no end"}
                    {" · "}
                    {promotion.banner.mode === "none" ? "no banner" : `${promotion.banner.mode} banner`}
                  </p>
                  <ul className="mt-2 text-sm">
                    {promotion.rules.map((rule, i) => (
                      <li key={i}>{ruleSummary(rule, categoryNames)}</li>
                    ))}
                    {promotion.rules.length === 0 && <li className="text-muted">No rules</li>}
                  </ul>
                  {missing && (
                    <p className="mt-1 text-sm text-blaze">
                      ⚠ A rule refers to a category or product that no longer exists.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-mono text-xs uppercase tracking-[0.14em] ${status.className}`}>
                    {status.label}
                  </span>
                  <Link
                    href={`/admin/promotions/${promotion.id}`}
                    className="rounded-md border border-line px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:border-ink hover:text-ink"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
