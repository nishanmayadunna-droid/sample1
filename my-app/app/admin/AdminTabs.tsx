import Link from "next/link";

type AdminTab = "products" | "orders" | "payments" | "customers" | "categories" | "promotions" | "reviews" | "promises" | "settings";

/** Section switcher shown at the top of the admin pages. */
export default function AdminTabs({ active }: { active: AdminTab }) {
  const tab = (key: AdminTab, href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`border-b-2 pb-2 font-mono text-[0.7rem] uppercase tracking-[0.16em] transition-colors ${
        active === key ? "border-blaze text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="mb-8 flex flex-wrap gap-x-6 gap-y-2">
      {tab("products", "/admin", "Products")}
      {tab("orders", "/admin/orders", "Orders")}
      {tab("payments", "/admin/payments", "Payments")}
      {tab("customers", "/admin/customers", "Customers")}
      {tab("categories", "/admin/categories", "Categories")}
      {tab("promotions", "/admin/promotions", "Promotions")}
      {tab("reviews", "/admin/reviews", "Reviews")}
      {tab("promises", "/admin/promises", "Promises")}
      {tab("settings", "/admin/settings", "Settings")}
    </nav>
  );
}
