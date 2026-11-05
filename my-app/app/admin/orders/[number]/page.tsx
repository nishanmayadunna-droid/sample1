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
import AdminTabs from "../../AdminTabs";
import PaymentReview from "../PaymentReview";
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
        {order.advanceAmount > 0
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
          advancePaid={order.advanceAmount > 0 && order.paymentStatus === "advance_paid"}
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

      {canShip && (
        <section className="mt-8">
          <h2 className="eyebrow text-muted">Shipment</h2>
          {order.courierName && order.trackingNumber && (
            <p className="mt-2 text-sm">
              {order.courierName} · <span className="font-mono">{order.trackingNumber}</span>
              {order.trackingUrl && (
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
