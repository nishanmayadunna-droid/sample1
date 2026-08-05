import type { Metadata } from "next";
import CartView from "../components/CartView";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review the items in your cart.",
};

export default function CartPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">Your cart</h1>
      <CartView />
    </div>
  );
}
