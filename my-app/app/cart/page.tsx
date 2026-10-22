import type { Metadata } from "next";
import { getAllProducts } from "@/lib/catalog";
import CartView from "../components/CartView";

// Re-fetch catalog data from Supabase at most once a minute (ISR).
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Cart",
  description: "Review the items in your cart.",
};

export default async function CartPage() {
  // The cart itself lives in localStorage; the server supplies current prices.
  const products = await getAllProducts();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">Your cart</h1>
      <CartView products={products} />
    </div>
  );
}
