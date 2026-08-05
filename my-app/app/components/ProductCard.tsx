import Link from "next/link";
import type { Product } from "@/lib/products";
import { formatPrice } from "@/lib/products";
import ProductImage from "./ProductImage";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-black/[.08] bg-white transition-shadow hover:shadow-lg dark:border-white/[.12] dark:bg-zinc-950"
    >
      <ProductImage
        product={product}
        className="aspect-[4/5] w-full transition-transform duration-300 group-hover:scale-[1.03]"
      />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {product.category}
        </span>
        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
          {product.name}
        </h3>
        <span className="mt-auto pt-2 font-semibold text-zinc-900 dark:text-zinc-100">
          {formatPrice(product.price)}
        </span>
      </div>
    </Link>
  );
}
