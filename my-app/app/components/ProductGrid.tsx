import type { PricedProduct } from "@/lib/products";
import ProductCard from "./ProductCard";

/** The shop's dense grid: 2 / 3 / 5 cards a row on phone / tablet / desktop. */
export default function ProductGrid({ products }: { products: PricedProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
