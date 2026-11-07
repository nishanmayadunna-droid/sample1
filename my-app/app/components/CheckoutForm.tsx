"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clear, useCart } from "@/app/context/CartContext";
import { useLang } from "@/app/context/LangContext";
import { placeOrder, type PlaceOrderResult } from "@/app/checkout/actions";
import { advanceFor, type AdvanceSettings } from "@/lib/advance";
import { pointsToUse, type PointsSettings } from "@/lib/points";
import { summarizeCart } from "@/lib/cart-summary";
import { tr } from "@/lib/i18n";
import type { DetailsField } from "@/lib/orders";
import { DISTRICTS, orderWeightGrams, shippingFeeFor, type Zone } from "@/lib/shipping";
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
  zones,
  categories,
  initialName,
  initialPhone,
  initialAddress,
  initialCity,
  initialDistrict,
  advanceInfo,
  pointsInfo,
  onlineAvailable,
}: {
  products: Product[];
  promotions: Promotion[];
  shippingFee: number;
  zones: Zone[];
  categories: Category[];
  initialName: string;
  initialPhone: string;
  initialAddress: string;
  initialCity: string;
  initialDistrict: string;
  /** Set when this customer must pay an advance (the server decides again on submit). */
  advanceInfo: AdvanceSettings | null;
  /** Set when the customer has points to spend (the server recomputes on submit). */
  pointsInfo: { settings: PointsSettings; balance: number } | null;
  /** Show the Card option (PayHere is on and has keys). Choosing it only changes where we go next. */
  onlineAvailable: boolean;
}) {
  const router = useRouter();
  const lang = useLang();
  const { lines, hydrated } = useCart();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<PlaceOrderResult | null>(null);
  // One key per checkout attempt: a double click or retry makes one order.
  const keyRef = useRef<string | null>(null);

  const [district, setDistrict] = useState(DISTRICTS.some((d) => d.en === initialDistrict) ? initialDistrict : "");
  // Preview only: placeOrder recomputes the fee on the server from the district.
  const districtFee = shippingFeeFor(
    district === "" ? null : district,
    zones,
    shippingFee,
    orderWeightGrams(lines, products),
  );
  const summary = summarizeCart(lines, products, promotions, districtFee, categories);
  // Points pay for goods after promotions, before shipping; they are only used when ticked.
  const [usePoints, setUsePoints] = useState(false);
  const [pointsText, setPointsText] = useState("");
  const goods = summary.subtotal - (summary.orderDiscount?.amount ?? 0);
  const maxPoints = pointsInfo ? pointsToUse(pointsInfo.balance, pointsInfo.balance, goods, pointsInfo.settings).points : 0;
  const wantedPoints = pointsText === "" ? maxPoints : Number(pointsText);
  const applied =
    pointsInfo && usePoints
      ? pointsToUse(wantedPoints, pointsInfo.balance, goods, pointsInfo.settings)
      : { points: 0, discount: 0 };
  const total = summary.total - applied.discount;
  const advance = advanceInfo ? advanceFor(total, advanceInfo) : 0;
  // "card" only decides the page we open after placing; the order is the same and
  // the order page re-checks everything before PayHere is ever contacted.
  const [payChoice, setPayChoice] = useState<"later" | "card">("later");
  const payByCard = onlineAvailable && payChoice === "card";

  // Between clearing the cart and arriving at the order page.
  if (result?.message === "placed") {
    return (
      <p className="py-16 font-mono text-sm text-muted">
        <L si="ඔබේ ඇණවුම ලැබුණා…" en="Order placed…" />
      </p>
    );
  }

  if (!hydrated) {
    return (
      <p className="py-16 font-mono text-sm text-muted">
        <L si="පූරණය වෙමින්…" en="Loading…" />
      </p>
    );
  }

  if (summary.items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-5 py-16">
        <p className="display text-3xl">
          <L si="ඔබේ කරත්තය හිස්" en="Your cart is empty" />
        </p>
        <Link href="/products" className="rounded-full bg-blaze px-6 py-3 font-medium text-onaccent">
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
      // A lost response must not look like a failure to place: keep the key, so
      // pressing the button again returns the same order if it was created.
      let outcome: PlaceOrderResult;
      try {
        outcome = await placeOrder(lines, fields, total, key, advance, applied.points);
      } catch {
        setResult({ message: "error" });
        return;
      }
      setResult(outcome);
      if (outcome.message === "placed" && outcome.orderNumber) {
        clear();
        router.push(`/orders/${outcome.orderNumber}${payByCard ? "?pay=online" : ""}`);
      } else if (
        outcome.message === "price_changed" ||
        outcome.message === "advance_changed" ||
        outcome.message === "points_changed" ||
        outcome.message === "out_of_stock" ||
        outcome.message === "unknown_product"
      ) {
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
            <L si="දිස්ත්‍රික්කය" en="District" />
          </span>
          <select
            name="district"
            value={district}
            onChange={(event) => setDistrict(event.target.value)}
            aria-invalid={bad.has("district")}
            className={inputClass}
            required
          >
            <option value="">{tr(lang, "දිස්ත්‍රික්කය තෝරන්න", "Select your district")}</option>
            {DISTRICTS.map((d) => (
              <option key={d.en} value={d.en}>
                {tr(lang, d.si, d.en)}
              </option>
            ))}
          </select>
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

        {pointsInfo && maxPoints > 0 && (
          <div className="rounded-md border border-line px-4 py-3 text-sm">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={usePoints}
                onChange={(event) => {
                  setUsePoints(event.target.checked);
                  setPointsText("");
                }}
              />
              <span>
                <L
                  si={`මගේ points භාවිතා කරන්න (ඇත්තේ ${pointsInfo.balance})`}
                  en={`Use my points (you have ${pointsInfo.balance})`}
                />
              </span>
            </label>
            {usePoints && (
              <label className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={maxPoints}
                  step={1}
                  value={pointsText === "" ? String(applied.points) : pointsText}
                  onChange={(event) => setPointsText(event.target.value)}
                  aria-label={tr(lang, "භාවිතා කරන points ගණන", "Points to use")}
                  className="w-28 rounded-md border border-line bg-bg px-3 py-2 font-mono outline-none focus:border-ink"
                />
                <span className="text-muted">
                  <L
                    si={`උපරිමය ${maxPoints} = ${formatPrice(maxPoints * pointsInfo.settings.pointValue)} වට්ටමක්`}
                    en={`Up to ${maxPoints} points = ${formatPrice(maxPoints * pointsInfo.settings.pointValue)} off`}
                  />
                </span>
              </label>
            )}
          </div>
        )}

        <h2 className="eyebrow mt-2 text-muted">
          <L si="ගෙවීම" en="Payment" />
        </h2>
        {onlineAvailable && (
          <fieldset className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-3 rounded-md border border-line px-4 py-3">
              <input type="radio" name="pay_choice" checked={payChoice === "later"} onChange={() => setPayChoice("later")} />
              <span>
                {advance > 0 ? (
                  <L si="බැංකු මාරුව (advance) / බඩු ලැබෙන විට ගෙවන්න" en="Bank transfer advance / pay on delivery" />
                ) : (
                  <L si="බඩු ලැබෙන විට ගෙවන්න (COD)" en="Cash on delivery" />
                )}
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-md border border-line px-4 py-3">
              <input type="radio" name="pay_choice" checked={payChoice === "card"} onChange={() => setPayChoice("card")} />
              <span>
                <L si="කාඩ්පතකින් ගෙවන්න (PayHere)" en="Pay by card (PayHere)" />
              </span>
            </label>
          </fieldset>
        )}
        {payByCard ? (
          <p className="rounded-md border border-line px-4 py-3 text-sm leading-relaxed">
            <L
              si="ඇණවුම ස්ථාපනය කළ පසු ආරක්ෂිත PayHere පිටුවට යයි. ගෙවීම සාර්ථක වූ විට ඇණවුම ස්වයංක්‍රීයව තහවුරු වේ."
              en="After you place the order you go straight to the secure PayHere page. When the payment succeeds, the order is confirmed automatically."
            />
          </p>
        ) : advance > 0 ? (
          <p className="rounded-md border border-line px-4 py-3 text-sm leading-relaxed">
            <L
              si={`අලුත් ගනුදෙනුකරුවන් ඇණවුම සඳහා කුඩා advance එකක් බැංකු මාරුවකින් ගෙවිය යුතුයි: ${formatPrice(advance)}. ඇණවුම ස්ථාපනය කළ පසු ඊළඟ පිටුවේ බැංකු විස්තර සහ slip එක upload කිරීම පෙන්වයි. ඉතිරි ${formatPrice(Math.max(total - advance, 0))} බඩු ලැබෙන විට ගෙවන්න.`}
              en={`New customers pay a small advance by bank transfer: ${formatPrice(advance)}. After you place the order, the next page shows the bank details and lets you upload your slip. The remaining ${formatPrice(Math.max(total - advance, 0))} is paid when it arrives.`}
            />
          </p>
        ) : (
          <p className="rounded-md border border-line px-4 py-3 text-sm">
            <L
              si="බඩු ලැබෙන විට ගෙවන්න (Cash on delivery)."
              en="Cash on delivery: pay when your order arrives."
            />
          </p>
        )}

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
        {result?.message === "points_changed" && (
          <p role="alert" className="text-sm text-blaze">
            <L
              si="ඔබේ points ශේෂය වෙනස් වී ඇත. නැවත පරීක්ෂා කර ඇණවුම් කරන්න."
              en="Your points balance changed. Please review the total and place the order again."
            />
          </p>
        )}
        {result?.message === "advance_changed" && (
          <p role="alert" className="text-sm text-blaze">
            <L
              si="ගෙවීමේ විස්තර වෙනස් වී ඇත. ඉහත විස්තර පරීක්ෂා කර නැවත ඇණවුම් කරන්න."
              en="The payment terms changed. Please review the details above and place the order again."
            />
          </p>
        )}
        {result?.message === "advance_setup" && (
          <p role="alert" className="text-sm text-blaze">
            <L
              si="ගෙවීම් තවම සකසා නැත. කරුණාකර අප අමතන්න."
              en="Payments aren't set up yet. Please contact us to place your order."
            />
          </p>
        )}
        {result?.message === "unknown_product" && (
          <p role="alert" className="text-sm text-blaze">
            <L
              si="ඔබේ කරත්තයේ ඇති භාණ්ඩයක් තවදුරටත් නොමැත. කරත්තය පරීක්ෂා කරන්න."
              en="An item in your cart is no longer available. Please check your cart."
            />{" "}
            <Link href="/cart" className="underline">
              <L si="කරත්තය" en="Cart" />
            </Link>
          </p>
        )}
        {result?.message === "too_many_pending" && (
          <p role="alert" className="text-sm text-blaze">
            <L
              si="ඔබට දැනටමත් තහවුරු කර නැති ඇණවුම් 3ක් ඇත. ඒවා තහවුරු වන තුරු හෝ අවලංගු කරන තුරු රැඳී සිටින්න."
              en="You already have 3 orders waiting for confirmation. Please wait until they are confirmed, or cancel one."
            />{" "}
            <Link href="/account" className="underline">
              <L si="මගේ ඇණවුම්" en="My orders" />
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
          className="rounded-full bg-blaze py-4 font-medium text-onaccent transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
        >
          <L si="ඇණවුම ස්ථාපනය කරන්න" en="Place order" /> · {formatPrice(total)}
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
        {applied.points > 0 && (
          <p className="mt-4 flex justify-between gap-4 font-mono text-sm">
            <span className="text-muted">
              <L si={`Points ${applied.points}ක්`} en={`${applied.points} points`} />
            </span>
            <span className="text-blaze">− {formatPrice(applied.discount)}</span>
          </p>
        )}
        <CartTotals summary={{ ...summary, total }} shippingIsEstimate={false} className="mt-4" />
      </aside>
    </div>
  );
}
