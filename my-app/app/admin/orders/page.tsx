import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { ORDER_STATUSES, statusLabel, type OrderStatus } from "@/lib/orders";
import { listOrdersForAdmin } from "@/lib/orders-data";
import { formatPrice } from "@/lib/products";
import AdminTabs from "../AdminTabs";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin("/admin/orders");
  const { status: rawStatus } = await searchParams;
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
