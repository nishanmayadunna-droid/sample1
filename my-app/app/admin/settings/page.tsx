import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { getStoreSettings } from "@/lib/storefront";
import AdminTabs from "../AdminTabs";
import { saveLanguageSettingsAction, saveShippingSettingsAction } from "./actions";
import ShippingForm from "./ShippingForm";
import LanguageForm from "./LanguageForm";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminSettingsPage() {
  await requireAdmin("/admin/settings");
  const settings = await getStoreSettings();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="settings" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Settings</h1>
      <div className="measure mt-6 text-ink" />

      <section className="mt-8">
        <h2 className="display text-2xl">Language</h2>
        <LanguageForm action={saveLanguageSettingsAction} settings={settings} />
      </section>

      <section className="mt-12">
        <h2 className="display text-2xl">Shipping</h2>
        <ShippingForm action={saveShippingSettingsAction} shippingFee={settings.shippingFee} />
      </section>
    </div>
  );
}
