import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { statusLabel } from "@/lib/orders";
import { listOrdersForUser } from "@/lib/orders-data";
import { isUserTrusted } from "@/lib/payments-data";
import { formatPrice } from "@/lib/products";
import SignOutButton from "../components/SignOutButton";
import L from "../components/L";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  // A failed read hides the list; it never breaks the account page.
  // A failed lookup just hides the badge.
  const trusted = await isUserTrusted(user.id).catch((error) => {
    console.error("trusted lookup failed", error);
    return false;
  });
  const orders = await listOrdersForUser(user.id).catch((error) => {
    console.error("orders list failed", error);
    return [];
  });

  const details: { key: string; label: React.ReactNode; value: React.ReactNode }[] = [
    { key: "email", label: <L si="ඊමේල්" en="Email" />, value: user.email },
    {
      key: "method",
      label: <L si="ඇතුළු වන ක්‍රමය" en="Sign-in method" />,
      value: user.googleId ? "Google" : <L si="මුරපදය" en="Password" />,
    },
    {
      key: "role",
      label: <L si="ගිණුම් වර්ගය" en="Account type" />,
      value:
        user.role === "admin" ? <L si="පරිපාලක" en="Admin" /> : <L si="පාරිභෝගික" en="Customer" />,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow text-muted">
        <L si="ඔබේ ගිණුම" en="Your account" />
      </p>
      <h1 className="display mt-2 text-5xl">{user.name ?? user.email}</h1>
      {trusted && (
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-blaze">
          ✓ <L si="තහවුරු කළ පාරිභෝගික" en="Verified customer" />
        </p>
      )}
      <div className="measure mt-6 text-ink" />
      <dl className="mt-8 divide-y divide-line border-y border-line">
        {details.map(({ key, label, value }) => (
          <div key={key} className="flex justify-between gap-4 py-4">
            <dt className="eyebrow text-muted">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>
      <h2 className="eyebrow mt-10 text-muted">
        <L si="මගේ ඇණවුම්" en="My orders" />
      </h2>
      {orders.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          <L si="තවම ඇණවුම් නැත." en="No orders yet." />
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {orders.map((order) => {
            const label = statusLabel(order.status);
            return (
              <li key={order.id}>
                <Link href={`/orders/${order.orderNumber}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-surface">
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

      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  );
}
