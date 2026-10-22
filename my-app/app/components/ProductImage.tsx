import Image from "next/image";
import type { Product } from "@/lib/products";

/**
 * Product visual: the product photo from Supabase Storage, laid over a
 * gradient from the product's swatch (visible while loading, and as the whole
 * visual if a product has no photo). Decorative — the surrounding link or
 * heading always carries the product name.
 */
export default function ProductImage({
  product,
  className = "",
  sizes = "(min-width: 1024px) 25vw, 50vw",
  preload = false,
}: {
  product: Product;
  className?: string;
  /** Rendered width hint for the srcset; match it to the layout slot. */
  sizes?: string;
  /** Preload above-the-fold images (replaces the deprecated `priority`). */
  preload?: boolean;
}) {
  const [from, to] = product.swatch;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(150deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      {product.imageUrl ? (
        <Image
          src={product.imageUrl}
          alt=""
          fill
          sizes={sizes}
          preload={preload}
          className="object-cover"
        />
      ) : (
        // No photo: oversized ghosted initial, legible on any swatch.
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-[9rem] leading-none text-white/25 mix-blend-overlay select-none">
          {product.name.charAt(0)}
        </span>
      )}

      {/* Category chip, top-left. */}
      <span className="absolute left-3 top-3 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-widest text-white/90">
        {product.category}
      </span>

      {/* Measure ticks along the base — the recurring ruler motif. */}
      <span
        className="absolute inset-x-0 bottom-0 h-2.5"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 1px, transparent 1px 10px)",
          WebkitMaskImage: "linear-gradient(0deg, #000, transparent)",
          maskImage: "linear-gradient(0deg, #000, transparent)",
        }}
      />
    </div>
  );
}
