"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clear, useCart } from "@/app/context/CartContext";
import { useLang } from "@/app/context/LangContext";
import { placeOrder, type PlaceOrderResult } from "@/app/checkout/actions";
import { summarizeCart } from "@/lib/cart-summary";
import { tr } from "@/lib/i18n";
import type { DetailsField } from "@/lib/orders";
import { formatPrice, type Category, type Product } from "@/lib/products";
import type { Promotion } from "@/lib/promotions";
import { CartTotals } from "./CartTotals";
import L from "./L";

const inputClass =
  "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink aria-[invalid=true]:border-blaze";

export default function CheckoutForm({
  products,
  promotions,
  shippingFee,
  categories,
  initialName,
  initialPhone,
  initialAddress,
  initialCity,
}: {
  products: Product[];
  promotions: Promotion[];
  shippingFee: number;
  categories: Category[];
  initialName: string;
  initialPhone: string;
  initialAddress: string;
  initialCity: string;
}) {
  const router = useRouter();
  const lang = useLang();
  const { lines, hydrated } = useCart();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<PlaceOrderResult | null>(null);
  // One key per checkout attempt: a double click or retry makes one order.
  const keyRef = useRef<string | null>(null);

  const summary = summarizeCart(lines, products, promotions, shippingFee, categories);

  if (!hydrated) {
    return (
      <p className="py-16 font-mono text-sm text-muted">
        <L si="පූරණය වෙමින්…" en="Loading…" />
      </p>
    );
  }

  if (summary.items.length === 0 && result?.message !== "placed") {
    return (
      <div className="flex flex-col items-start gap-5 py-16">
        <p className="display text-3xl">
          <L si="ඔබේ කරත්තය හිස්" en="Your cart is empty" />
        </p>
        <Link href="/products" className="rounded-full bg-blaze px-6 py-3 font-medium text-white">
          <L si="සාප්පුව බලන්න" en="Browse the shop" />
        </Link>
      </div>
    );
  }

  const bad = new Set<DetailsField>(result?.message === "details" ? result.fields : []);
  const stockProduct = result?.productId ? products.find((p) => p.id === result.productId) : undefined;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields: Record<string, string> = {};
    for (const [name, value] of form.entries()) if (typeof value === "string") fields[name] = value;
    keyRef.current ??= crypto.randomUUID();
    const key = keyRef.current;
    startTransition(async () => {
      const outcome = await placeOrder(lines, fields, summary.total, key);
      setResult(outcome);
      if (outcome.message === "placed" && outcome.orderNumber) {
        clear();
        router.push(`/orders/${outcome.orderNumber}`);
      } else if (outcome.message === "price_changed" || outcome.message === "out_of_stock") {
        // Pull the shop's current prices and stock into this page.
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <form onSubmit={submit} className="flex max-w-xl flex-col gap-5" noValidate>
        <h2 className="eyebrow text-muted">
          <L si="බෙදාහැරීමේ විස්තර" en="Delivery details" />
        </h2>
        <label className="block">
          <span className="eyebrow text-muted">
            <L si="නම" en="Full name" />
          </span>
          <input name="name" defaultValue={initialName} autoComplete="name" aria-invalid={bad.has("name")} className={inputClass} required />
        </label>
        <label className="block">
          <span className="eyebrow text-muted">
            <L si="දුරකථන අංකය" en="Mobile number" />
          </span>
          <input
            name="phone"
            type="tel"
            defaultValue={initialPhone}
            autoComplete="tel"
            placeholder="07X XXX XXXX"
            aria-invalid={bad.has("phone")}
            className={inputClass}
            required
          />
          {bad.has("phone") && (
            <span className="mt-1 block text-sm text-blaze">
              <L si="වලංගු ශ්‍රී ලංකා ජංගම අංකයක් ඇතුළත් කරන්න (07XXXXXXXX)." en="Enter a valid Sri Lankan mobile number (07XXXXXXXX)." />
            </span>
          )}
        </label>
        <label className="block">
          <span className="eyebrow text-muted">
            <L si="ලිපිනය" en="Address" />
          </span>
          <input name="address" defaultValue={initialAddress} autoComplete="street-address" aria-invalid={bad.has("address")} className={inputClass} required />
        </label>
        <label className="block">
          <span className="eyebrow text-muted">
            <L si="නගරය" en="City" />
          </span>
          <input name="city" defaultValue={initialCity} autoComplete="address-level2" aria-invalid={bad.has("city")} className={inputClass} required />
        </label>
        <label className="block">
          <span className="eyebrow text-muted">
            <L si="සටහනක් (අවශ්‍ය නම්)" en="Note (optional)" />
          </span>
          <textarea name="note" rows={3} maxLength={500} aria-invalid={bad.has("note")} className={inputClass} />
        </label>
        {result?.message === "details" && (
          <p role="alert" className="text-sm text-blaze">
            <L si="උද්දීපනය කළ ක්ෂේත්‍ර නිවැරදි කරන්න." en="Please fix the highlighted fields." />
          </p>
        )}

        <h2 className="eyebrow mt-2 text-muted">
          <L si="ගෙවීම" en="Payment" />
        </h2>
        <p className="rounded-md border border-line px-4 py-3 text-sm">
          <L
            si="බඩු ලැබෙන විට ගෙවන්න (Cash on delivery)."
            en="Cash on delivery: pay when your order arrives."
          />
        </p>

        {result?.message === "price_changed" && (
          <p role="alert" className="text-sm text-blaze">
            <L
              si={`මිල වෙනස් වී ඇත. නව මුළු මුදල ${formatPrice(result.total ?? 0)}. පරීක්ෂා කර නැවත ඇණවුම් කරන්න.`}
              en={`Prices changed. The new total is ${formatPrice(result.total ?? 0)}. Please review and place the order again.`}
            />
          </p>
        )}
        {result?.message === "out_of_stock" && (
          <p role="alert" className="text-sm text-blaze">
            <L
              si={`${stockProduct?.name ?? "එක් භාණ්ඩයක්"} (${result.size}) ${result.left ? `${result.left}ක් පමණක් ඉතිරියි` : "අවසන්"}.`}
              en={`${stockProduct?.name ?? "An item"} (${result.size}) ${result.left ? `has only ${result.left} left` : "is sold out"}.`}
            />{" "}
            <Link href="/cart" className="underline">
              <L si="කරත්තය වෙනස් කරන්න" en="Change your cart" />
            </Link>
          </p>
        )}
        {result?.message === "error" && (
          <p role="alert" className="text-sm text-blaze">
            <L si="යම් දෝෂයක් සිදු විය. කරත්තය පරීක්ෂා කර නැවත උත්සාහ කරන්න." en="Something went wrong. Check your cart and try again." />{" "}
            <Link href="/cart" className="underline">
              <L si="කරත්තය" en="Cart" />
            </Link>
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          aria-label={tr(lang, "ඇණවුම ස්ථාපනය කරන්න", "Place order")}
          className="rounded-full bg-blaze py-4 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
        >
          <L si="ඇණවුම ස්ථාපනය කරන්න" en="Place order" /> · {formatPrice(summary.total)}
        </button>
      </form>

      <aside className="h-fit border border-line bg-surface p-6">
        <h2 className="eyebrow text-muted">
          <L si="ඇණවුම් සාරාංශය" en="Order summary" />
        </h2>
        <ul className="mt-4 divide-y divide-line">
          {summary.items.map(({ line, product, unitPrice }) => (
            <li key={`${line.id}::${line.size}`} className="flex justify-between gap-3 py-2 text-sm">
              <span>
                {product.name}
                <span className="block font-mono text-xs text-muted">
                  {line.size} × {line.quantity}
                </span>
              </span>
              <span className="font-mono">{formatPrice(unitPrice * line.quantity)}</span>
            </li>
          ))}
        </ul>
        <CartTotals summary={summary} className="mt-4" />
      </aside>
    </div>
  );
}
