import Link from "next/link";
import type { Product } from "@/lib/products";
import { discountPercent, formatPrice } from "@/lib/products";
import ProductImage from "./ProductImage";

export default function ProductCard({ product }: { product: Product }) {
  const discount = discountPercent(product);

  return (
    <Link href={`/products/${product.id}`} className="group flex flex-col">
      <div className="relative overflow-hidden rounded-[10px] border border-line bg-surface">
        <ProductImage
          product={product}
          className="aspect-[4/5] w-full transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        {discount != null && (
          <span className="absolute right-3 top-3 rounded bg-blaze px-1.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-widest text-white">
            −{discount}%
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 pt-3">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted">
          {product.spec.construction} · {product.spec.origin}
        </span>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-medium leading-snug decoration-blaze decoration-2 underline-offset-4 group-hover:underline">
            {product.name}
          </h3>
          {product.salePrice != null ? (
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="font-mono text-sm text-blaze">
                {formatPrice(product.salePrice)}
              </span>
              <span className="font-mono text-xs text-muted line-through">
                {formatPrice(product.price)}
              </span>
            </span>
          ) : (
            <span className="shrink-0 font-mono text-sm">
              {formatPrice(product.price)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
