import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { getProductForAdmin } from "@/lib/admin-products";
import { updateProductAction } from "../actions";
import ProductForm from "../ProductForm";

export const metadata: Metadata = { title: "Admin" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin(`/admin/products/${encodeURIComponent(id)}`);
  const product = await getProductForAdmin(id);
  if (!product) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/admin" className="eyebrow text-muted hover:text-ink">
        ← Products
      </Link>
      <h1 className="display mt-2 text-5xl">{product.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {product.published ? "Published" : "Hidden"} ·{" "}
        <Link href={`/products/${product.id}`} className="underline hover:text-ink">
          View in shop
        </Link>
      </p>
      <div className="measure mt-6 text-ink" />
      <ProductForm
        mode="update"
        action={updateProductAction.bind(null, product.id)}
        product={product}
      />
    </div>
  );
}
