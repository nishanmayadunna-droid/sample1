import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { paymentStatusLabel } from "@/lib/advance";
import { cancelReasonLabel, statusLabel } from "@/lib/orders";
import { getOrderForAdmin } from "@/lib/orders-data";
import { listCouriers } from "@/lib/shipping-data";
import { isUserTrusted, listSlipsForOrder, slipSignedUrl } from "@/lib/payments-data";
import { formatPrice } from "@/lib/products";
import { canRefund, refundMethodLabel, refundSummary } from "@/lib/refunds";
import { listRefundsForOrder } from "@/lib/refunds-data";
import { listPaymentsForOrder } from "@/lib/payhere-data";
import AdminTabs from "../../AdminTabs";
import PaymentReview from "../PaymentReview";
import RefundForm from "../RefundForm";
import ShipmentForm from "../ShipmentForm";
import StatusButtons from "../StatusButtons";
import WaiveAdvanceButton from "../WaiveAdvanceButton";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  await requireAdmin(`/admin/orders/${number}`);
  const order = await getOrderForAdmin(number);
  if (!order) notFound();

  // A trusted customer who still owes an advance: the admin may want to waive it.
  const canWaive =
    (order.status === "pending" || order.status === "confirmed") &&
    order.advanceAmount > 0 &&
    (order.paymentStatus === "advance_due" || order.paymentStatus === "slip_uploaded");
  const trusted = canWaive
    ? await isUserTrusted(order.userId).catch((error) => {
        console.error("trusted lookup failed", error);
        return false;
      })
    : false;

  // Slips are private: each gets a 60-second link, made now for this admin view.
  const slips =
    order.advanceAmount > 0
      ? await Promise.all(
          (await listSlipsForOrder(order.id)).map(async (slip) => ({ ...slip, url: await slipSignedUrl(slip.path) })),
        )
      : [];

  // A cancelled order whose advance was approved: the money is owed back.
  const refundable = canRefund(order);
  const refunds = refundable ? await listRefundsForOrder(order.id) : [];
  const refundInfo = refundSummary(order.advanceAmount, refunds);

  // Online (PayHere) payments for this order, to show what was paid and any that need a refund.
  const onlinePayments = await listPaymentsForOrder(order.id).catch((error) => {
    console.error("online payments lookup failed", error);
    return [];
  });
  const onlineStuck = onlinePayments.filter(
    (p) =>
      (p.status === "paid" && (order.paymentStatus !== "online_paid" || order.status === "cancelled")) ||
      p.status === "overpaid" ||
      p.status === "chargedback" ||
      p.status === "mismatch",
  );

  const canShip = order.status === "confirmed" || order.status === "shipped";
  const couriers = canShip
    ? (
        await listCouriers().catch((error) => {
          console.error("couriers lookup failed", error);
          return [];
        })
      ).filter((c) => c.active)
    : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <AdminTabs active="orders" />
      <Link href="/admin/orders" className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:text-ink">
        ← All orders
      </Link>
      <h1 className="display mt-3 text-5xl">{order.orderNumber}</h1>
      <p className="mt-2 font-mono text-xs text-muted">
        {new Date(order.createdAt).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })} ·{" "}
        <span className={order.status === "pending" ? "text-blaze" : ""}>{statusLabel(order.status).en}</span> ·
        {order.paymentStatus === "online_paid"
          ? `Paid online ${formatPrice(order.onlinePaidAmount)}`
          : order.advanceAmount > 0
          ? `Advance ${formatPrice(order.advanceAmount)} (${paymentStatusLabel(order.paymentStatus).en})`
          : "Cash on delivery (unpaid)"}
        {order.advanceWaivedAt ? " · Advance waived" : ""}
        {order.cancelReason ? ` · ${cancelReasonLabel(order.cancelReason).en}` : ""}
      </p>
      <Link
        href={`/admin/orders/${order.orderNumber}/print`}
        target="_blank"
        className="mt-3 inline-block text-sm text-blaze underline underline-offset-4"
      >
        Print slip
      </Link>
      <div className="measure mt-6 text-ink" />

      <div className="mt-6">
        <StatusButtons
          orderId={order.id}
          status={order.status}
          advanceUnpaid={order.advanceAmount > 0 && order.paymentStatus !== "advance_paid"}
          advancePaid={
            (order.advanceAmount > 0 && order.paymentStatus === "advance_paid") || order.paymentStatus === "online_paid"
          }
        />
      </div>

      {order.advanceAmount > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow text-muted">Advance payment</h2>
          <p className="mt-2 text-sm">
            {formatPrice(order.advanceAmount)} by bank transfer; the customer pays {formatPrice(Math.max(order.total - order.advanceAmount, 0))}{" "}
            on delivery.
          </p>
          {canWaive && (
            <div className="mt-3">
              {trusted && (
                <p className="mb-2 text-sm text-blaze">This customer is trusted: consider waiving the advance.</p>
              )}
              <WaiveAdvanceButton orderId={order.id} />
            </div>
          )}
          {slips.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No slip uploaded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {slips.map((slip, index) => (
                <li key={slip.id} className="flex flex-wrap items-center gap-4 py-3">
                  <div className="min-w-48 flex-1 text-sm">
                    Slip {index + 1}{" "}
                    <span className="font-mono text-xs text-muted">
                      {new Date(slip.createdAt).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}
                    </span>
                    {slip.url ? (
                      <a href={slip.url} target="_blank" rel="noreferrer" className="ml-3 text-blaze underline underline-offset-4">
                        View
                      </a>
                    ) : (
                      <span className="ml-3 text-xs text-muted">(file unavailable)</span>
                    )}
                    {slip.status === "rejected" && slip.rejectReason && (
                      <span className="block text-xs text-muted">Rejected: {slip.rejectReason}</span>
                    )}
                  </div>
                  <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">{slip.status}</span>
                  {slip.status === "pending" && <PaymentReview slipId={slip.id} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(order.paymentStatus === "online_paid" || onlinePayments.length > 0) && (
        <section className="mt-8">
          <h2 className="eyebrow text-muted">Online payment</h2>
          {order.paymentStatus === "online_paid" && (
            <p className="mt-2 text-sm">
              Paid online {formatPrice(order.onlinePaidAmount)}
              {order.onlinePaidAt && ` on ${new Date(order.onlinePaidAt).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}`}
              {order.onlineDiscount > 0 && ` · customer saved ${formatPrice(order.onlineDiscount)}`}. The courier collects nothing.
              {order.onlineGift && <span className="block text-blaze">Gift to include: {order.onlineGift}</span>}
            </p>
          )}
          {onlineStuck.length > 0 && (
            <ul className="mt-2 text-sm text-blaze">
              {onlineStuck.map((p) => (
                <li key={p.id}>
                  {formatPrice(p.amount)} ({p.status}): refund this in the PayHere dashboard
                  {p.paymentId && <span className="font-mono text-xs"> (payment {p.paymentId})</span>}.
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">
            {onlinePayments.length} attempt{onlinePayments.length === 1 ? "" : "s"}. Refunds are made in PayHere, not here.
          </p>
        </section>
      )}

      {refundable && (
        <section className="mt-8">
          <h2 className="eyebrow text-muted">Refund</h2>
          <p className="mt-2 text-sm">
            Advance paid {formatPrice(order.advanceAmount)} · refunded {formatPrice(refundInfo.refunded)} ·{" "}
            <span className={refundInfo.remaining > 0 ? "text-blaze" : ""}>
              {refundInfo.remaining > 0 ? `still owed ${formatPrice(refundInfo.remaining)}` : "fully refunded"}
            </span>
          </p>
          {refunds.length > 0 && (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {refunds.map((refund) => (
                <li key={refund.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                  <span>
                    {formatPrice(refund.amount)} · {refundMethodLabel(refund.method).en}
                    {refund.reference && <span className="ml-2 font-mono text-xs text-muted">{refund.reference}</span>}
                    {refund.note && <span className="block text-xs text-muted">{refund.note}</span>}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {new Date(refund.createdAt).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {refundInfo.remaining > 0 && (
            <RefundForm key={refunds.length} orderId={order.id} remaining={refundInfo.remaining} />
          )}
          <p className="mt-2 text-xs text-muted">
            This only records a refund you have already sent. Nothing is paid from here.
          </p>
        </section>
      )}

      {canShip && (
        <section className="mt-8">
          <h2 className="eyebrow text-muted">Shipment</h2>
          {order.courierName && order.trackingNumber && (
            <p className="mt-2 text-sm">
              {order.courierName} · <span className="font-mono">{order.trackingNumber}</span>
              {order.trackingUrl?.startsWith("https://") && (
                <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="ml-3 text-blaze underline underline-offset-4">
                  Track
                </a>
              )}
            </p>
          )}
          <ShipmentForm
            key={`${order.courierName}-${order.trackingNumber}`}
            orderNumber={order.orderNumber}
            couriers={couriers.map((c) => ({ id: c.id, name: c.name }))}
            courierName={order.courierName}
            trackingNumber={order.trackingNumber}
          />
        </section>
      )}

      <section className="mt-8">
        <h2 className="eyebrow text-muted">Customer</h2>
        <p className="mt-2 text-sm leading-relaxed">
          {order.customerName}
          <br />
          <a href={`tel:${order.phone}`} className="text-blaze underline underline-offset-4">
            {order.phone}
          </a>
          <br />
          <span className="whitespace-pre-line">{order.address}</span>
          <br />
          {order.city}
          {order.district && (
            <>
              <br />
              {order.district} district
            </>
          )}
        </p>
        {order.note && <p className="mt-2 whitespace-pre-line text-sm text-muted">Note: {order.note}</p>}
      </section>

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {order.items.map((item, index) => (
          <li key={`${item.productId ?? item.productName}-${item.size}-${index}`} className="flex justify-between gap-4 py-3">
            <span className="text-sm">
              {item.productName}
              {!item.productId && <span className="ml-2 text-xs text-muted">(product deleted)</span>}
              <span className="block font-mono text-xs text-muted">
                {item.size} × {item.quantity} @ {formatPrice(item.unitPrice)}
              </span>
            </span>
            <span className="font-mono text-sm">{formatPrice(item.unitPrice * item.quantity)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-6 flex flex-col gap-2 font-mono text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd>{formatPrice(order.subtotal)}</dd>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">Discount</dt>
            <dd>− {formatPrice(order.discount)}</dd>
          </div>
        )}
        {order.pointsUsed > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">Points used ({order.pointsUsed})</dt>
            <dd>− {formatPrice(order.pointsDiscount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">Shipping</dt>
          <dd>{order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</dd>
        </div>
        {order.pointsToEarn > 0 && (
          <div className="flex justify-between text-muted">
            <dt>Points the customer earns on delivery</dt>
            <dd>{order.pointsToEarn}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-3 text-base">
          <dt>To collect</dt>
          <dd>{formatPrice(order.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
