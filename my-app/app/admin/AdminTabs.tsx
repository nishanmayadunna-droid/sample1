import Link from "next/link";

/** "Products · Categories" switcher shown at the top of the admin pages. */
export default function AdminTabs({ active }: { active: "products" | "categories" }) {
  const tab = (key: "products" | "categories", href: string, label: string) => (
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
    <nav className="mb-8 flex gap-6">
      {tab("products", "/admin", "Products")}
      {tab("categories", "/admin/categories", "Categories")}
    </nav>
  );
}
