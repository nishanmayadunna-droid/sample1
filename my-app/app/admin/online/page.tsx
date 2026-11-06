import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { getPayhereSettings, listPayments, payhereConfigured, type PaymentRow } from "@/lib/payhere-data";
import { formatPrice } from "@/lib/products";
import { absoluteUrl, isLocalFallback, siteUrl } from "@/lib/site";
import AdminTabs from "../AdminTabs";
import PayhereSettingsForm from "./PayhereSettingsForm";

export const metadata: Metadata = { title: "Admin" };

const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", dateStyle: "medium", timeStyle: "short" });

/** Money that arrived but that the order did not take, or that was taken back: needs a person. */
function needsAttention(row: PaymentRow): string | null {
  if (row.status === "overpaid") return "Paid twice: refund this one in PayHere";
  if (row.status === "chargedback") return "Charged back by the customer's bank";
  if (row.status === "paid" && row.orderPaymentStatus !== "online_paid") {
    return "Paid, but the order could not take it (cancelled or already paid): refund in PayHere";
  }
  return null;
}

export default async function AdminOnlinePage() {
  await requireAdmin("/admin/online");
  const [settings, payments] = await Promise.all([
    getPayhereSettings(),
    listPayments(100).catch((): PaymentRow[] => []),
  ]);
  const keysSet = payhereConfigured();
  const localhost = isLocalFallback(siteUrl());
  const attention = payments.filter((row) => needsAttention(row) !== null);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="online" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Online payments</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Customers can pay a pending order by card through PayHere. The order is marked paid only when PayHere&apos;s own
        notification arrives and its signature checks out; the customer returning to the shop proves nothing. Paying
        online can earn a discount and a gift (below). Refunds are made in the PayHere dashboard.
      </p>

      <dl className="mt-6 grid max-w-2xl gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-md border border-line px-4 py-3">
          <dt className="eyebrow text-muted">Merchant keys</dt>
          <dd className="mt-1 font-mono">{keysSet ? "set" : "not set"}</dd>
        </div>
        <div className="rounded-md border border-line px-4 py-3">
          <dt className="eyebrow text-muted">Mode</dt>
          <dd className="mt-1 font-mono">{settings.sandbox ? "sandbox (test)" : "live"}</dd>
        </div>
      </dl>
      <p className="mt-3 max-w-prose text-sm text-muted">
        The keys are the server environment variables PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET (in .env.local and
        in Vercel). The secret is tied to the domain you register with PayHere.
      </p>
      <p className="mt-2 max-w-prose text-sm text-muted">
        PayHere must be able to reach <span className="font-mono">{absoluteUrl("/api/payhere/notify")}</span>.
        {localhost &&
          " That is a local address: PayHere cannot call it, so payments will not be confirmed until the shop has a public address (set NEXT_PUBLIC_SITE_URL)."}
      </p>

      <section className="mt-8">
        <h2 className="display text-2xl">Settings</h2>
        <div className="mt-4">
          <PayhereSettingsForm settings={settings} />
        </div>
      </section>

      {attention.length > 0 && (
        <section className="mt-10">
          <h2 className="display text-2xl text-blaze">Needs attention</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {attention.map((row) => (
              <li key={row.id} className="py-3 text-sm">
                <Link href={`/admin/orders/${row.orderNumber}`} className="font-mono underline">
                  {row.orderNumber}
                </Link>{" "}
                · {formatPrice(row.amount)} · {needsAttention(row)}
                {row.paymentId && <span className="block font-mono text-xs text-muted">PayHere payment {row.paymentId}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="display text-2xl">Recent attempts</h2>
        {payments.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="eyebrow text-muted">
                  <th className="py-2 pr-4 font-normal">Time (Colombo)</th>
                  <th className="py-2 pr-4 font-normal">Order</th>
                  <th className="py-2 pr-4 font-normal">Amount</th>
                  <th className="py-2 pr-4 font-normal">Saved</th>
                  <th className="py-2 pr-4 font-normal">Method</th>
                  <th className="py-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((row) => (
                  <tr key={row.id} className="border-t border-line align-top">
                    <td className="py-2 pr-4 font-mono">{timeFormat.format(new Date(row.paidAt ?? row.createdAt))}</td>
                    <td className="py-2 pr-4 font-mono">
                      <Link href={`/admin/orders/${row.orderNumber}`} className="underline">
                        {row.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 font-mono">{formatPrice(row.amount)}</td>
                    <td className="py-2 pr-4 font-mono">{row.discount > 0 ? formatPrice(row.discount) : "-"}</td>
                    <td className="py-2 pr-4">{row.method ?? "-"}</td>
                    <td className="py-2 font-mono">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
