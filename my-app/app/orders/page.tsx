import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { statusLabel } from "@/lib/orders";
import { listOrdersForUser } from "@/lib/orders-data";
import { formatPrice } from "@/lib/products";
import L from "../components/L";

export const metadata: Metadata = { title: "My orders" };

// Per-user (reads the session), so dynamic. Only the signed-in customer's own orders.
export default async function MyOrdersPage() {
  const user = await requireUser("/orders");
  // A failed read shows the empty state; it never breaks the page.
  const orders = await listOrdersForUser(user.id).catch((error) => {
    console.error("orders list failed", error);
    return [];
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="display text-4xl">
        <L si="මගේ ඇණවුම්" en="My orders" />
      </h1>
      <div className="measure mt-6 text-ink" />
      {orders.length === 0 ? (
        <div className="mt-6 flex flex-col items-start gap-4">
          <p className="text-sm text-muted">
            <L si="තවම ඇණවුම් නැත." en="No orders yet." />
          </p>
          <Link href="/products" className="rounded-full bg-blaze px-6 py-3 font-medium text-onaccent">
            <L si="සාප්පුව බලන්න" en="Browse the shop" />
          </Link>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {orders.map((order) => {
            const label = statusLabel(order.status);
            return (
              <li key={order.id}>
                <Link href={`/orders/${order.orderNumber}`} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-surface">
                  <span>
                    <span className="font-mono text-sm">{order.orderNumber}</span>
                    <span className="block font-mono text-xs text-muted">
                      {new Date(order.createdAt).toLocaleDateString("en-LK", { timeZone: "Asia/Colombo", day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </span>
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                    <L si={label.si} en={label.en} />
                  </span>
                  <span className="font-mono text-sm">{formatPrice(order.total)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
