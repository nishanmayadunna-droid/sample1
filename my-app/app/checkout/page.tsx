import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-guards";
import { getAllProducts, getCategories } from "@/lib/catalog";
import { advanceRequired, type AdvanceSettings } from "@/lib/advance";
import { getLatestDetailsForUser } from "@/lib/orders-data";
import { getPointsBalance, getPointsSettings } from "@/lib/points-data";
import type { PointsSettings } from "@/lib/points";
import { getPaymentSettings, isUserTrusted } from "@/lib/payments-data";
import { getZones } from "@/lib/shipping-data";
import { getRunningPromotions, getStoreSettings } from "@/lib/storefront";
import CheckoutForm from "../components/CheckoutForm";
import L from "../components/L";

export const metadata: Metadata = { title: "Checkout" };

// Per-user (it reads the session), so unlike the catalog pages it is dynamic.
export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const [products, categories, promotions, settings, zones, initialDetails, advanceInfo, pointsInfo] = await Promise.all([
    getAllProducts(),
    getCategories(),
    getRunningPromotions(),
    getStoreSettings(),
    getZones(),
    getLatestDetailsForUser(user.id).catch((error) => {
      console.error("latest order details failed", error);
      return null;
    }),
    // The form only previews the advance; placeOrder decides it again on the server.
    Promise.all([isUserTrusted(user.id), getPaymentSettings()])
      .then(([trusted, payment]): AdvanceSettings | null => (advanceRequired(trusted, payment) ? payment : null))
      .catch((error) => {
        console.error("payment settings failed", error);
        return null;
      }),
    // The form only previews points; placeOrder recomputes them on the server.
    Promise.all([getPointsSettings(), getPointsBalance(user.id)])
      .then(([pointsSettings, balance]): { settings: PointsSettings; balance: number } | null =>
        pointsSettings.enabled && balance > 0 ? { settings: pointsSettings, balance } : null,
      )
      .catch((error) => {
        console.error("points info failed", error);
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
        zones={zones}
        categories={categories}
        initialName={initialDetails?.name ?? user.name ?? ""}
        initialPhone={initialDetails?.phone ?? ""}
        initialAddress={initialDetails?.address ?? ""}
        initialCity={initialDetails?.city ?? ""}
        initialDistrict={initialDetails?.district ?? ""}
        advanceInfo={advanceInfo}
        pointsInfo={pointsInfo}
      />
    </div>
  );
}
