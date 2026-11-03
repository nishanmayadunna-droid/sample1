import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { MAX_SLIPS, paymentStatusLabel } from "@/lib/advance";
import { canCustomerCancel } from "@/lib/orders";
import { getOrderForUser } from "@/lib/orders-data";
import { getPaymentSettings, listQrCodes, listSlipsForOrder, qrSignedUrls } from "@/lib/payments-data";
import { formatPrice } from "@/lib/products";
import CancelOrderButton from "../../components/CancelOrderButton";
import L from "../../components/L";
import OrderStatusSteps from "../../components/OrderStatusSteps";
import PaymentPanel from "../../components/PaymentPanel";

export const metadata: Metadata = { title: "Your order" };

// Per-user, so dynamic. Someone else's order number is a plain 404.
export default async function OrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await requireUser(`/orders/${number}`);
  const order = await getOrderForUser(number, user.id);
  if (!order) notFound();

  // An advance order that is still waiting for its advance shows how to pay it.
  const awaitingAdvance =
    order.advanceAmount > 0 &&
    order.status !== "cancelled" &&
    (order.paymentStatus === "advance_due" || order.paymentStatus === "slip_uploaded");
  const payment = awaitingAdvance
    ? await Promise.all([
        getPaymentSettings(),
        listQrCodes().then(qrSignedUrls),
        listSlipsForOrder(order.id),
      ]).catch((error) => {
        console.error("payment panel data failed", error);
        return null;
      })
    : null;
  const remaining = Math.max(order.total - order.advanceAmount, 0);

  const rows: { key: string; label: React.ReactNode; value: React.ReactNode }[] = [
    { key: "subtotal", label: <L si="උප එකතුව" en="Subtotal" />, value: formatPrice(order.subtotal) },
    ...(order.discount > 0
      ? [{ key: "discount", label: <L si="වට්ටම" en="Discount" />, value: `− ${formatPrice(order.discount)}` }]
      : []),
    ...(order.pointsUsed > 0
      ? [
          {
            key: "points",
            label: <L si={`Points ${order.pointsUsed}ක්`} en={`${order.pointsUsed} points`} />,
            value: `− ${formatPrice(order.pointsDiscount)}`,
          },
        ]
      : []),
    {
      key: "shipping",
      label: <L si="බෙදාහැරීම" en="Shipping" />,
      value: order.shipping === 0 ? <L si="නොමිලේ" en="Free" /> : formatPrice(order.shipping),
    },
    { key: "total", label: <L si="මුළු මුදල" en="Total" />, value: formatPrice(order.total) },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow text-muted">
        <L si="ඔබේ ඇණවුම" en="Your order" />
      </p>
      <h1 className="display mt-2 text-5xl">{order.orderNumber}</h1>
      <p className="mt-3 font-mono text-xs text-muted">
        {new Date(order.createdAt).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}
      </p>
      <div className="measure mt-6 text-ink" />

      <div className="mt-6">
        <OrderStatusSteps status={order.status} />
      </div>
      {order.status === "pending" && (
        <p className="mt-4 text-sm text-muted">
          <L
            si="ස්තූතියි! ඔබේ ඇණවුම ලැබුණා. අපි ඔබව අමතා තහවුරු කරන්නෙමු."
            en="Thank you! We've received your order and will call you to confirm it."
          />
        </p>
      )}

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {order.items.map((item, index) => (
          <li key={`${item.productId ?? item.productName}-${item.size}-${index}`} className="flex justify-between gap-4 py-3">
            <span>
              {item.productId ? (
                <Link href={`/products/${item.productId}`} className="hover:underline">
                  {item.productName}
                </Link>
              ) : (
                item.productName
              )}
              <span className="block font-mono text-xs text-muted">
                {item.size} × {item.quantity}
              </span>
            </span>
            <span className="font-mono text-sm">{formatPrice(item.unitPrice * item.quantity)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-6 flex flex-col gap-2 font-mono text-sm">
        {rows.map(({ key, label, value }) => (
          <div key={key} className={`flex justify-between gap-4 ${key === "total" ? "border-t border-line pt-3 text-base" : ""}`}>
            <dt className="text-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {order.pointsToEarn > 0 && order.status !== "cancelled" && (
        <p className="mt-4 text-sm text-muted">
          {order.status === "delivered" ? (
            <L si={`Points ${order.pointsToEarn}ක් ලැබුණා.`} en={`${order.pointsToEarn} points earned.`} />
          ) : (
            <L
              si={`බඩු ලැබුණාම ඔබට points ${order.pointsToEarn}ක් ලැබේ.`}
              en={`You'll earn ${order.pointsToEarn} points when it's delivered.`}
            />
          )}
        </p>
      )}
      {order.status === "cancelled" && order.pointsUsed > 0 && (
        <p className="mt-4 text-sm text-muted">
          <L si={`භාවිතා කළ points ${order.pointsUsed}ක් ආපහු ලැබුණා.`} en={`${order.pointsUsed} points returned.`} />
        </p>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="eyebrow text-muted">
            <L si="බෙදාහැරීමේ විස්තර" en="Delivery details" />
          </h2>
          <p className="mt-2 text-sm leading-relaxed">
            {order.customerName}
            <br />
            {order.phone}
            <br />
            <span className="whitespace-pre-line">{order.address}</span>
            <br />
            {order.city}
          </p>
          {order.note && <p className="mt-2 whitespace-pre-line text-sm text-muted">{order.note}</p>}
        </div>
        <div>
          <h2 className="eyebrow text-muted">
            <L si="ගෙවීම" en="Payment" />
          </h2>
          {order.advanceAmount > 0 ? (
            <p className="mt-2 text-sm leading-relaxed">
              <L si={`Advance ${formatPrice(order.advanceAmount)}`} en={`Advance ${formatPrice(order.advanceAmount)}`} />:{" "}
              <L si={paymentStatusLabel(order.paymentStatus).si} en={paymentStatusLabel(order.paymentStatus).en} />
              <br />
              <L si={`බඩු ලැබෙන විට ගෙවන්න: ${formatPrice(remaining)}`} en={`Pay on delivery: ${formatPrice(remaining)}`} />
            </p>
          ) : (
            <p className="mt-2 text-sm">
              <L si="බඩු ලැබෙන විට ගෙවන්න (Cash on delivery)." en="Cash on delivery: pay when your order arrives." />
            </p>
          )}
        </div>
      </div>

      {payment && (
        <PaymentPanel
          orderNumber={order.orderNumber}
          advanceAmount={order.advanceAmount}
          total={order.total}
          bank={payment[0]}
          qr={payment[1]}
          slips={payment[2].map((slip) => ({
            id: slip.id,
            status: slip.status,
            rejectReason: slip.rejectReason,
            createdAt: slip.createdAt,
          }))}
          canUpload={payment[2].length < MAX_SLIPS}
        />
      )}

      {canCustomerCancel(order.status, order.paymentStatus) && (
        <div className="mt-8">
          <CancelOrderButton orderNumber={order.orderNumber} />
        </div>
      )}
      {order.status === "pending" && !canCustomerCancel(order.status, order.paymentStatus) && (
        <p className="mt-8 text-sm text-muted">
          <L
            si="ඔබේ advance එක ලැබී ඇති නිසා මෙම ඇණවුම අවලංගු කිරීමට අප අමතන්න."
            en="Your advance is already in, so please contact us if you want to cancel this order."
          />
        </p>
      )}
    </div>
  );
}
