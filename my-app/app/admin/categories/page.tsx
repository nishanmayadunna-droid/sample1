import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { listCategoriesForAdmin } from "@/lib/admin-categories";
import AdminTabs from "../AdminTabs";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories");
  const categories = await listCategoriesForAdmin();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="categories" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted">Staff only</p>
          <h1 className="display mt-2 text-5xl">Categories</h1>
        </div>
        <Link
          href="/admin/categories/new"
          className="rounded-full bg-blaze px-6 py-3 font-medium text-onaccent transition-transform hover:-translate-y-0.5"
        >
          New category
        </Link>
      </div>
      <div className="measure mt-6 text-ink" />

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {categories.map((category) => (
          <li key={category.slug} className="flex flex-wrap items-center gap-4 py-4">
            <span
              aria-hidden
              className="h-12 w-12 shrink-0 rounded-lg border border-line"
              style={{
                background: `linear-gradient(150deg, ${category.swatch[0]}, ${category.swatch[1]})`,
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{category.name}</p>
              <p className="font-mono text-xs text-muted">{category.slug}</p>
            </div>
            <span className="eyebrow text-muted">
              {category.productCount} {category.productCount === 1 ? "product" : "products"}
            </span>
            <Link
              href={`/admin/categories/${category.slug}`}
              className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted hover:text-ink"
            >
              Edit
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
