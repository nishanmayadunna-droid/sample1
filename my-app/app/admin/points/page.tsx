import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { getPointsSettings } from "@/lib/points-data";
import AdminTabs from "../AdminTabs";
import PointsSettingsForm from "./PointsSettingsForm";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPointsPage() {
  await requireAdmin("/admin/points");
  const settings = await getPointsSettings();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="points" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Points</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Customers earn points when an order is delivered and spend them at checkout as a discount on the goods. Points
        already earned keep their number when you change these settings; the current value of a point applies to the
        points customers still hold. You can add or remove points for a customer under Customers.
      </p>
      <section className="mt-8">
        <PointsSettingsForm settings={settings} />
      </section>
    </div>
  );
}
