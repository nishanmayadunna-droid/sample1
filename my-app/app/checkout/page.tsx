import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-guards";
import { getAllProducts, getCategories } from "@/lib/catalog";
import { getLatestDetailsForUser } from "@/lib/orders-data";
import { getRunningPromotions, getStoreSettings } from "@/lib/storefront";
import CheckoutForm from "../components/CheckoutForm";
import L from "../components/L";

export const metadata: Metadata = { title: "Checkout" };

// Per-user (it reads the session), so unlike the catalog pages it is dynamic.
export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const [products, categories, promotions, settings, initialDetails] = await Promise.all([
    getAllProducts(),
    getCategories(),
    getRunningPromotions(),
    getStoreSettings(),
    getLatestDetailsForUser(user.id).catch((error) => {
      console.error("latest order details failed", error);
      return null;
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">
        <L si="ඇණවුම තහවුරු කරන්න" en="Checkout" />
      </h1>
      <CheckoutForm
        products={products}
        promotions={promotions}
        shippingFee={settings.shippingFee}
        categories={categories}
        initialName={initialDetails?.name ?? user.name ?? ""}
        initialPhone={initialDetails?.phone ?? ""}
        initialAddress={initialDetails?.address ?? ""}
        initialCity={initialDetails?.city ?? ""}
      />
    </div>
  );
}
