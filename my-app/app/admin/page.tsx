import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { listProductsForAdmin } from "@/lib/admin-products";
import { formatPrice } from "@/lib/products";
import ProductImage from "../components/ProductImage";
import PublishToggle from "./PublishToggle";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin("/admin");
  const products = await listProductsForAdmin();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted">Staff only</p>
          <h1 className="display mt-2 text-5xl">Products</h1>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-full bg-blaze px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5"
        >
          New product
        </Link>
      </div>
      <div className="measure mt-6 text-ink" />

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {products.map((product) => (
          <li key={product.id} className="flex flex-wrap items-center gap-4 py-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line">
              <ProductImage product={product} sizes="64px" className="h-full w-full" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{product.name}</p>
              <p className="font-mono text-xs text-muted">
                {product.id} · {product.category}
              </p>
            </div>
            <p className="text-sm">
              {product.salePrice != null ? (
                <>
                  <span className="text-blaze">{formatPrice(product.salePrice)}</span>{" "}
                  <span className="text-muted line-through">{formatPrice(product.price)}</span>
                </>
              ) : (
                formatPrice(product.price)
              )}
            </p>
            <span
              className={`eyebrow rounded-full border px-3 py-1 ${
                product.published ? "border-ink text-ink" : "border-line text-muted"
              }`}
            >
              {product.published ? "Published" : "Hidden"}
            </span>
            <Link
              href={`/admin/products/${product.id}`}
              className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted hover:text-ink"
            >
              Edit
            </Link>
            <PublishToggle id={product.id} published={product.published} />
          </li>
        ))}
      </ul>
    </div>
  );
}
