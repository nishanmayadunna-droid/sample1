import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { listCustomersForAdmin } from "@/lib/payments-data";
import { balancesForUsers } from "@/lib/points-data";
import AdminTabs from "../AdminTabs";
import AdjustPoints from "./AdjustPoints";
import TrustToggle from "./TrustToggle";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminCustomersPage() {
  await requireAdmin("/admin/customers");
  const customers = await listCustomersForAdmin();
  // A failed points read just shows 0; it never hides the customers.
  const balances = await balancesForUsers(customers.map((customer) => customer.id)).catch((error) => {
    console.error("points balances failed", error);
    return new Map<string, number>();
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="customers" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Customers</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Trusted customers order with plain cash on delivery. Customers become trusted when you approve their advance
        slip, or when you trust them here (people you know and have good dealings with). The newest 200 are shown.
      </p>

      {customers.length === 0 ? (
        <p className="mt-8 text-muted">No customers yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {customers.map((customer) => (
            <li key={customer.id} className="flex flex-wrap items-center gap-4 py-4">
              <div className="min-w-56 flex-1">
                <p className="text-sm">{customer.name ?? <span className="text-muted">(no name)</span>}</p>
                <p className="font-mono text-xs text-muted">{customer.email}</p>
              </div>
              <span className="font-mono text-xs text-muted">
                {customer.orderCount} {customer.orderCount === 1 ? "order" : "orders"}
              </span>
              <span
                className={`font-mono text-[0.7rem] uppercase tracking-[0.14em] ${
                  customer.trusted ? "text-blaze" : "text-muted"
                }`}
              >
                {customer.trusted
                  ? `Trusted (${customer.trustedSource === "advance" ? "paid advance" : "by you"})`
                  : "Not trusted"}
              </span>
              <span className="font-mono text-xs text-muted">{balances.get(customer.id) ?? 0} pts</span>
              <TrustToggle userId={customer.id} trusted={customer.trusted} />
              <AdjustPoints userId={customer.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
