import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { createCategoryAction } from "../actions";
import CategoryForm from "../CategoryForm";

export const metadata: Metadata = { title: "Admin" };

export default async function NewCategoryPage() {
  await requireAdmin("/admin/categories/new");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/admin/categories" className="eyebrow text-muted hover:text-ink">
        ← Categories
      </Link>
      <h1 className="display mt-2 text-5xl">New category</h1>
      <div className="measure mt-6 text-ink" />
      <CategoryForm mode="create" action={createCategoryAction} />
    </div>
  );
}
