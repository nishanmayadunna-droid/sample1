import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { formatPrice } from "@/lib/products";
import { getStoreSettings } from "@/lib/storefront";
import { getZones, listCouriers } from "@/lib/shipping-data";
import AdminTabs from "../AdminTabs";
import CouriersEditor from "./CouriersEditor";
import ZonesEditor from "./ZonesEditor";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminShippingPage() {
  await requireAdmin("/admin/shipping");
  const [zones, couriers, settings] = await Promise.all([getZones(), listCouriers(), getStoreSettings()]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="shipping" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Shipping</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Group districts into zones with their own delivery fee. A district that is in no zone is charged the default
        fee, {formatPrice(settings.shippingFee)}, which you change under{" "}
        <Link href="/admin/settings" className="text-blaze underline underline-offset-4">
          Settings
        </Link>
        . A free-shipping promotion still makes the order ship free.
      </p>

      <section className="mt-8">
        <h2 className="display text-2xl">Zones</h2>
        <ZonesEditor
          zones={zones.map((zone) => ({
            name: zone.name,
            fee: String(zone.fee / 100),
            districts: zone.districts,
            bands: (zone.bands ?? []).map((band) => ({ upToGrams: String(band.upToGrams), fee: String(band.fee / 100) })),
            extraPerKg: (zone.extraPerKg ?? 0) > 0 ? String((zone.extraPerKg ?? 0) / 100) : "",
          }))}
        />
      </section>

      <section className="mt-12">
        <h2 className="display text-2xl">Couriers</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Pick one of these when you add shipment details to an order. The link template turns a tracking number into a
          tracking link for the customer.
        </p>
        <CouriersEditor couriers={couriers} />
      </section>
    </div>
  );
}
