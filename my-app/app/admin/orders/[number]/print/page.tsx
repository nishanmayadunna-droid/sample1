import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { collectOnDelivery } from "@/lib/orders";
import { getOrderForAdmin } from "@/lib/orders-data";
import { formatPrice } from "@/lib/products";
import PrintButton from "./PrintButton";

export const metadata: Metadata = { title: "Print slip" };

// Hide the storefront shell (promise strip, header, drawer, footer) and fit one small page.
const PRINT_CSS = `
@page { size: A5; margin: 10mm; }
@media print {
  body > *:not(main) { display: none !important; }
  main { display: block !important; }
  .slip { max-width: none !important; padding: 0 !important; }
}
`;

export default async function PrintSlipPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  await requireAdmin(`/admin/orders/${number}/print`);
  const order = await getOrderForAdmin(number);
  if (!order) notFound();

  const collect = collectOnDelivery(order);
  const prepaid = order.paymentStatus === "advance_paid" && order.advanceAmount > 0;

  return (
    <div className="slip mx-auto w-full max-w-xl px-4 py-8 text-sm">
      <style>{PRINT_CSS}</style>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-4xl">{order.orderNumber}</h1>
          <p className="mt-1 font-mono text-xs">
            {new Date(order.createdAt).toLocaleDateString("en-LK", { timeZone: "Asia/Colombo" })}
          </p>
        </div>
        <PrintButton />
      </div>

      <section className="mt-4 border-t border-ink pt-3 leading-relaxed">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em]">Deliver to</p>
        <p className="text-base font-semibold">{order.customerName}</p>
        <p className="font-mono">{order.phone}</p>
        <p className="whitespace-pre-line">{order.address}</p>
        <p>
          {order.city}
          {order.district ? `, ${order.district}` : ""}
        </p>
      </section>

      <table className="mt-4 w-full border-y border-ink text-left">
        <thead>
          <tr className="font-mono text-[0.65rem] uppercase tracking-[0.14em]">
            <th className="py-1 font-normal">Item</th>
            <th className="py-1 font-normal">Size</th>
            <th className="py-1 text-right font-normal">Qty</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={`${item.productId ?? item.productName}-${item.size}-${index}`} className="border-t border-line">
              <td className="py-1">{item.productName}</td>
              <td className="py-1 font-mono">{item.size}</td>
              <td className="py-1 text-right font-mono">{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {order.note && <p className="mt-3 whitespace-pre-line">Note: {order.note}</p>}
      {order.courierName && order.trackingNumber && (
        <p className="mt-3">
          Courier: {order.courierName} · Tracking: <span className="font-mono">{order.trackingNumber}</span>
        </p>
      )}

      <div className="mt-5 border-2 border-ink p-3 text-center">
        <p className="display text-3xl">Collect on delivery: {formatPrice(collect)}</p>
        {prepaid && (
          <p className="mt-1 font-mono text-xs">
            Paid in advance: {formatPrice(order.advanceAmount)} (order total {formatPrice(order.total)})
          </p>
        )}
      </div>
    </div>
  );
}
