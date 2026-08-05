import Link from "next/link";
import type { Product } from "@/lib/products";
import { formatPrice } from "@/lib/products";
import ProductImage from "./ProductImage";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/products/${product.id}`} className="group flex flex-col">
      <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
        <ProductImage
          product={product}
          className="aspect-[4/5] w-full transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 pt-3">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted">
          {product.spec.construction} · {product.spec.origin}
        </span>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-medium leading-snug decoration-blaze decoration-2 underline-offset-4 group-hover:underline">
            {product.name}
          </h3>
          <span className="shrink-0 font-mono text-sm">
            {formatPrice(product.price)}
          </span>
        </div>
      </div>
    </Link>
  );
}
