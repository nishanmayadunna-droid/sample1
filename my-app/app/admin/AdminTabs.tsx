import Link from "next/link";

type AdminTab = "products" | "orders" | "payments" | "online" | "shipping" | "customers" | "points" | "categories" | "promotions" | "reviews" | "promises" | "sms" | "notifications" | "email" | "newsletter" | "settings";

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
      {tab("online", "/admin/online", "Online pay")}
      {tab("shipping", "/admin/shipping", "Shipping")}
      {tab("customers", "/admin/customers", "Customers")}
      {tab("points", "/admin/points", "Points")}
      {tab("categories", "/admin/categories", "Categories")}
      {tab("promotions", "/admin/promotions", "Promotions")}
      {tab("reviews", "/admin/reviews", "Reviews")}
      {tab("promises", "/admin/promises", "Promises")}
      {tab("sms", "/admin/sms", "SMS")}
      {tab("notifications", "/admin/notifications", "Notifications")}
      {tab("email", "/admin/email", "Email")}
      {tab("newsletter", "/admin/newsletter", "Newsletter")}
      {tab("settings", "/admin/settings", "Settings")}
    </nav>
  );
}
