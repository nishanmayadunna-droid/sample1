import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { PUSH_DAILY_CAP } from "@/lib/push";
import {
  countOwnerDevices,
  firebaseWebConfigured,
  getPushSettings,
  listPushLog,
  pushConfigured,
  type PushLogRow,
} from "@/lib/push-data";
import PushToggle from "../../components/PushToggle";
import AdminTabs from "../AdminTabs";
import { registerAdminPushAction, unregisterAdminPushAction } from "./actions";
import PushSettingsForm from "./PushSettingsForm";

export const metadata: Metadata = { title: "Admin" };

const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", dateStyle: "medium", timeStyle: "short" });

export default async function AdminPushPage() {
  await requireAdmin("/admin/push");
  const [settings, log, devices] = await Promise.all([
    getPushSettings(),
    listPushLog(100).catch((): PushLogRow[] => []),
    countOwnerDevices().catch(() => 0),
  ]);
  const serverKeys = pushConfigured();
  const webConfig = firebaseWebConfigured();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="push" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Push notifications</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Short alerts on a phone or browser through Firebase Cloud Messaging: the owner gets the same four events as the
        SMS alerts, and customers get their own order updates. Push is always in addition to SMS and email, never
        instead of them. Each person turns it on for their own device with a button; nobody is asked for permission
        until they click it. At most {PUSH_DAILY_CAP} push messages are sent in 24 hours.
      </p>

      <dl className="mt-6 grid max-w-3xl gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-md border border-line px-4 py-3">
          <dt className="eyebrow text-muted">Server keys</dt>
          <dd className="mt-1 font-mono">{serverKeys ? "set" : "not set"}</dd>
        </div>
        <div className="rounded-md border border-line px-4 py-3">
          <dt className="eyebrow text-muted">Web config</dt>
          <dd className="mt-1 font-mono">{webConfig ? "set" : "not set"}</dd>
        </div>
        <div className="rounded-md border border-line px-4 py-3">
          <dt className="eyebrow text-muted">Your devices</dt>
          <dd className="mt-1 font-mono">{devices}</dd>
        </div>
      </dl>
      <p className="mt-3 max-w-prose text-sm text-muted">
        Server keys: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY. Web config: the
        NEXT_PUBLIC_FIREBASE_* values and NEXT_PUBLIC_FIREBASE_VAPID_KEY (these are baked in when the site is built, so
        rebuild after adding them). The values are never shown here. Device tokens are secrets and are never listed.
      </p>

      <section className="mt-8">
        <h2 className="display text-2xl">Settings</h2>
        <div className="mt-4">
          <PushSettingsForm settings={settings} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl">Alerts on this device</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Turn this on in the browser or phone you carry, so the owner alerts reach you. Push works on iPhone only after
          the site is added to the Home Screen.
        </p>
        <div className="mt-4">
          <PushToggle register={registerAdminPushAction} unregister={unregisterAdminPushAction} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl">Recent pushes</h2>
        {log.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="eyebrow text-muted">
                  <th className="py-2 pr-4 font-normal">Time (Colombo)</th>
                  <th className="py-2 pr-4 font-normal">To</th>
                  <th className="py-2 pr-4 font-normal">Event</th>
                  <th className="py-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {log.map((row) => (
                  <tr key={row.id} className="border-t border-line align-top">
                    <td className="py-2 pr-4 font-mono">{timeFormat.format(new Date(row.createdAt))}</td>
                    <td className="py-2 pr-4 font-mono">{row.kind === "owner" ? "owner devices" : row.recipient}</td>
                    <td className="py-2 pr-4">{row.event}</td>
                    <td className="py-2 font-mono">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
