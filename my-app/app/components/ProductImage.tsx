import type { Product } from "@/lib/products";

/**
 * A self-contained product visual. Instead of shipping/hosting real photos,
 * we render a deterministic gradient from the product's swatch plus a simple
 * garment glyph, so the store works fully offline with no image config.
 */
export default function ProductImage({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const [from, to] = product.swatch;
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-1/3 w-1/3 text-white/40"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 7l4-3 4 3 4-3 4 3-2 3-2-1v11H8V9L6 10 4 7z" />
      </svg>
    </div>
  );
}
