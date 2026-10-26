import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { getCategoryForAdmin } from "@/lib/admin-categories";
import { updateCategoryAction } from "../actions";
import CategoryForm from "../CategoryForm";
import DeleteCategory from "../DeleteCategory";

export const metadata: Metadata = { title: "Admin" };

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireAdmin(`/admin/categories/${encodeURIComponent(slug)}`);
  const category = await getCategoryForAdmin(slug);
  if (!category) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/admin/categories" className="eyebrow text-muted hover:text-ink">
        ← Categories
      </Link>
      <h1 className="display mt-2 text-5xl">{category.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {category.productCount} {category.productCount === 1 ? "product" : "products"} ·{" "}
        <Link
          href={`/products?category=${encodeURIComponent(category.slug)}`}
          className="underline hover:text-ink"
        >
          View in shop
        </Link>
      </p>
      <div className="measure mt-6 text-ink" />
      <CategoryForm
        mode="update"
        action={updateCategoryAction.bind(null, category.slug)}
        category={category}
      />
      <DeleteCategory
        slug={category.slug}
        name={category.name}
        productCount={category.productCount}
      />
    </div>
  );
}
