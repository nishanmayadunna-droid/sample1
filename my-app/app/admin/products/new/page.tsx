import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { createProductAction } from "../actions";
import ProductForm from "../ProductForm";

export const metadata: Metadata = { title: "Admin" };

export default async function NewProductPage() {
  await requireAdmin("/admin/products/new");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/admin" className="eyebrow text-muted hover:text-ink">
        ← Products
      </Link>
      <h1 className="display mt-2 text-5xl">New product</h1>
      <div className="measure mt-6 text-ink" />
      <ProductForm mode="create" action={createProductAction} />
    </div>
  );
}
