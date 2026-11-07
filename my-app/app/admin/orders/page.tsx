import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { advanceDeadline, isAdvanceStale } from "@/lib/advance";
import { ORDER_STATUSES, statusLabel, type OrderStatus } from "@/lib/orders";
import { listAwaitingAdvanceOrders, listOrdersForAdmin, listRefundCandidates } from "@/lib/orders-data";
import { refundSummary } from "@/lib/refunds";
import { refundedTotals } from "@/lib/refunds-data";
import { getPaymentSettings } from "@/lib/payments-data";
import { formatPrice } from "@/lib/products";
import AdminTabs from "../AdminTabs";
import CancelStaleButton from "./CancelStaleButton";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  await requireAdmin("/admin/orders");
  const { status: rawStatus, view } = await searchParams;
  if (view === "advance") return <AwaitingAdvanceView />;
  if (view === "refunds") return <RefundsView />;
  const status = ORDER_STATUSES.find((s) => s === rawStatus);
  const orders = await listOrdersForAdmin(status);
  const pendingCount = status ? null : orders.filter((order) => order.status === "pending").length;

  const filter = (value: OrderStatus | undefined, label: string) => (
    <Link
      key={label}
      href={value ? `/admin/orders?status=${value}` : "/admin/orders"}
      aria-current={status === value ? "page" : undefined}
      className={`rounded-full border px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] ${
        status === value ? "border-blaze text-ink" : "border-line text-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="orders" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Orders</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Cash on delivery. Call new (pending) orders to confirm them, then ship and deliver.
        {pendingCount ? ` ${pendingCount} waiting for confirmation.` : ""}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {filter(undefined, "All")}
        {ORDER_STATUSES.map((s) => filter(s, statusLabel(s).en))}
        <Link
          href="/admin/orders?view=advance"
          className="rounded-full border border-line px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:text-ink"
        >
          Awaiting advance
        </Link>
        <Link
          href="/admin/orders?view=refunds"
          className="rounded-full border border-line px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:text-ink"
        >
          Refunds
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="mt-8 text-muted">No orders.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/admin/orders/${order.orderNumber}`}
                className="flex flex-wrap items-center justify-between gap-4 py-4 hover:bg-surface"
              >
                <span className="min-w-40">
                  <span className="font-mono text-sm">{order.orderNumber}</span>
                  <span className="block font-mono text-xs text-muted">
                    {new Date(order.createdAt).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}
                  </span>
                </span>
                <span className="min-w-40 flex-1 text-sm">
                  {order.customerName}
                  <span className="block font-mono text-xs text-muted">
                    {order.phone} · {order.city}
                  </span>
                </span>
                <span
                  className={`font-mono text-[0.7rem] uppercase tracking-[0.14em] ${
                    order.status === "pending" ? "text-blaze" : "text-muted"
                  }`}
                >
                  {statusLabel(order.status).en}
                </span>
                <span className="font-mono text-sm">{formatPrice(order.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Cancelled orders with an approved advance, owed ones first. */
async function RefundsView() {
  const candidates = await listRefundCandidates();
  const totals = await refundedTotals(candidates.map((order) => order.id));
  const rows = candidates
    .map((order) => ({ order, info: refundSummary(order.advanceAmount, [{ amount: totals.get(order.id) ?? 0 }]) }))
    .sort((a, b) => Number(b.info.remaining > 0) - Number(a.info.remaining > 0));
  const owedCount = rows.filter((row) => row.info.remaining > 0).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="orders" />
      <Link href="/admin/orders" className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:text-ink">
        ← All orders
      </Link>
      <h1 className="display mt-3 text-5xl">Refunds</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Cancelled orders whose advance was approved. Send the money back yourself, then record it on the order.
        {owedCount > 0 ? ` ${owedCount} still owed.` : ""}
      </p>
      {rows.length === 0 ? (
        <p className="mt-8 text-muted">No cancelled orders with a paid advance.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {rows.map(({ order, info }) => (
            <li key={order.id}>
              <Link
                href={`/admin/orders/${order.orderNumber}`}
                className="flex flex-wrap items-center justify-between gap-4 py-4 hover:bg-surface"
              >
                <span className="min-w-40">
                  <span className="font-mono text-sm">{order.orderNumber}</span>
                  <span className="block font-mono text-xs text-muted">
                    {new Date(order.createdAt).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}
                  </span>
                </span>
                <span className="min-w-40 flex-1 text-sm">
                  {order.customerName}
                  <span className="block font-mono text-xs text-muted">{order.phone}</span>
                </span>
                <span className="font-mono text-xs text-muted">
                  advance {formatPrice(order.advanceAmount)} · refunded {formatPrice(info.refunded)}
                </span>
                <span
                  className={`font-mono text-[0.7rem] uppercase tracking-[0.14em] ${
                    info.remaining > 0 ? "text-blaze" : "text-muted"
                  }`}
                >
                  {info.remaining > 0 ? `owed ${formatPrice(info.remaining)}` : "done"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "2 d 3 h", "5 h" or "under 1 h". */
function formatAge(ms: number): string {
  const hours = Math.floor(ms / 3600_000);
  if (hours < 1) return "under 1 h";
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days} d ${hours % 24} h` : `${hours} h`;
}

async function AwaitingAdvanceView() {
  const [rows, payment] = await Promise.all([listAwaitingAdvanceOrders(), getPaymentSettings()]);
  const now = new Date();
  const staleCount = rows.filter(({ order, lastReviewedAt }) =>
    isAdvanceStale(order, lastReviewedAt, payment.expiryHours, now),
  ).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="orders" />
      <Link href="/admin/orders" className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:text-ink">
        ← All orders
      </Link>
      <h1 className="display mt-3 text-5xl">Awaiting advance</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Pending orders whose advance hasn&apos;t been approved yet. Their stock is held until the advance arrives.{" "}
        {payment.expiryHours > 0
          ? `An order with no slip waiting for review is cancelled ${payment.expiryHours} hours after it was placed (or after its last rejected slip).`
          : "Automatic cancelling is off (set the hours under Payments)."}
      </p>
      {payment.expiryHours > 0 && (
        <div className="mt-4">
          <CancelStaleButton staleCount={staleCount} />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-8 text-muted">No orders are waiting for an advance.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {rows.map(({ order, lastReviewedAt }) => {
            const stale = isAdvanceStale(order, lastReviewedAt, payment.expiryHours, now);
            const deadline = order.paymentStatus === "advance_due"
              ? advanceDeadline(order.createdAt, lastReviewedAt, payment.expiryHours)
              : null;
            return (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.orderNumber}`}
                  className="flex flex-wrap items-center justify-between gap-4 py-4 hover:bg-surface"
                >
                  <span className="min-w-40">
                    <span className="font-mono text-sm">{order.orderNumber}</span>
                    <span className="block font-mono text-xs text-muted">
                      {formatAge(now.getTime() - Date.parse(order.createdAt))} old
                    </span>
                  </span>
                  <span className="min-w-40 flex-1 text-sm">
                    {order.customerName}
                    <span className="block font-mono text-xs text-muted">
                      {order.phone} · advance {formatPrice(order.advanceAmount)}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {order.paymentStatus === "slip_uploaded"
                      ? "slip being checked"
                      : deadline
                        ? `expires ${deadline.toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}`
                        : "no expiry"}
                  </span>
                  {stale && (
                    <span className="rounded bg-blaze px-1.5 py-0.5 font-mono text-[0.65rem] uppercase text-onaccent">
                      stale
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
