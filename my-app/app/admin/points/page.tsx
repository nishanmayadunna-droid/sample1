import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { getPointsSettings } from "@/lib/points-data";
import { getExpiryDays, listBonuses, listTiers } from "@/lib/points-v2-data";
import type { PointsBonus, PointsTier } from "@/lib/points-v2";
import AdminTabs from "../AdminTabs";
import { BonusSection, ExpirySection, TierSection } from "./PointsExtras";
import PointsSettingsForm from "./PointsSettingsForm";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPointsPage() {
  await requireAdmin("/admin/points");
  const [settings, expiryDays, bonuses, tiers] = await Promise.all([
    getPointsSettings(),
    getExpiryDays().catch(() => 0),
    listBonuses().catch((): PointsBonus[] => []),
    listTiers().catch((): PointsTier[] => []),
  ]);

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

      <section className="mt-12">
        <h2 className="display text-2xl">Expiry</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Points a customer has not spent expire this many days after they were earned (the oldest points are spent
          first). 0 means they never expire. Expiry runs once a day if the schedule migration is applied, or when you
          press Expire now.
        </p>
        <div className="mt-4">
          <ExpirySection days={expiryDays} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="display text-2xl">Bonus events</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          While a bonus is running, orders placed earn that much extra (100% = double). The points are fixed when the
          order is placed and credited on delivery. Only the best running bonus applies; it adds to the customer&apos;s
          tier bonus.
        </p>
        <div className="mt-4">
          <BonusSection bonuses={bonuses} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="display text-2xl">Tiers</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          A customer&apos;s level comes from what they have spent in total on delivered orders (goods only). A higher
          level earns extra points on every order. At most 5 tiers.
        </p>
        <div className="mt-4">
          <TierSection tiers={tiers} />
        </div>
      </section>
    </div>
  );
}
