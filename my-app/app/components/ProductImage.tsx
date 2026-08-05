import type { Product } from "@/lib/products";

/**
 * A self-contained product visual. Instead of hosting photos, we render a
 * gradient from the product's swatch with an oversized ghosted display letter,
 * so every tile is distinct and on-brand with no image/network config.
 */
export default function ProductImage({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const [from, to] = product.swatch;
  const initial = product.name.charAt(0);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(150deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      {/* Oversized ghosted initial — mix-blend keeps it legible on any swatch. */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-[9rem] leading-none text-white/25 mix-blend-overlay select-none">
        {initial}
      </span>

      {/* Category chip, top-left. */}
      <span className="absolute left-3 top-3 rounded bg-black/25 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-widest text-white/90">
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
