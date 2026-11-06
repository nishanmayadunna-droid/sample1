import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { getNotificationSettings, listNotifications, type NotificationRow } from "@/lib/notifications-data";
import { getOwnerAlertSettings, listOwnerAlerts, type OwnerAlertRow } from "@/lib/owner-alerts-data";
import { OWNER_EVENT_LABELS } from "@/lib/owner-alerts";
import { pushAvailable } from "@/lib/push-data";
import { smsTokenSet } from "@/lib/sms";
import PushToggle from "../../components/PushToggle";
import { registerAdminPushAction, unregisterAdminPushAction } from "../push/actions";
import AdminTabs from "../AdminTabs";
import OwnerAlertsForm from "./OwnerAlertsForm";
import NotificationSettingsForm from "./NotificationSettingsForm";
import ResendButton from "./ResendButton";
import { EVENT_LABELS } from "./labels";

export const metadata: Metadata = { title: "Admin" };

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Colombo",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminNotificationsPage() {
  await requireAdmin("/admin/notifications");
  const [settings, log, ownerSettings, ownerLog] = await Promise.all([
    getNotificationSettings(),
    listNotifications(100).catch((): NotificationRow[] => []),
    getOwnerAlertSettings(),
    listOwnerAlerts(50).catch((): OwnerAlertRow[] => []),
  ]);
  const tokenSet = smsTokenSet();
  const push = await pushAvailable().catch(() => ({ available: false }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="notifications" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Notifications</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Customers get an SMS at the main points of an order. Sending needs the SMS sender ID to be set on the SMS tab.
        Sinhala messages cost more per SMS (about 70 characters per message). Each message is sent once per order
        event, so turning the switch on later does not send earlier events. Orders cancelled automatically by the
        schedule get no SMS; only &quot;Cancel stale now&quot; sends those (within 24 hours of the cancellation).
        Resend may rarely send a message twice if a previous attempt died midway.
      </p>

      <dl className="mt-6 max-w-2xl text-sm">
        <div className="rounded-md border border-line px-4 py-3">
          <dt className="eyebrow text-muted">API token</dt>
          <dd className="mt-1 font-mono">{tokenSet ? "set" : "not set"}</dd>
        </div>
      </dl>
      <p className="mt-3 max-w-prose text-sm text-muted">
        The token is set as the server environment variable TEXTLK_API_TOKEN (in .env.local and in Vercel).
      </p>

      <section className="mt-8">
        <h2 className="display text-2xl">Settings</h2>
        <NotificationSettingsForm settings={settings} />
      </section>

      {push.available && (
        <section className="mt-10">
          <h2 className="display text-2xl">Push alerts on this device</h2>
          <p className="mt-2 max-w-prose text-sm text-muted">
            Get the owner alerts as a push notification on this browser or phone. Which events are sent is set under{" "}
            <a href="/admin/push" className="underline">
              Push
            </a>
            .
          </p>
          <div className="mt-4">
            <PushToggle register={registerAdminPushAction} unregister={unregisterAdminPushAction} />
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="display text-2xl">Alerts to you</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          A short SMS to your own phone for new orders, payment slips, low stock and customer messages that failed.
          It uses the same token and sender ID. At most 40 alerts are sent in 24 hours, low stock repeats once per
          size per day, and everything is English to keep each SMS to one or two parts.
        </p>
        <div className="mt-4">
          <OwnerAlertsForm settings={ownerSettings} />
        </div>
        {ownerLog.length > 0 && (
          <table className="mt-6 w-full max-w-2xl text-left text-sm">
            <thead>
              <tr className="eyebrow text-muted">
                <th className="py-2 pr-4 font-normal">Time (Colombo)</th>
                <th className="py-2 pr-4 font-normal">Alert</th>
                <th className="py-2 pr-4 font-normal">Status</th>
                <th className="py-2 font-normal">SMS</th>
              </tr>
            </thead>
            <tbody>
              {ownerLog.map((row) => (
                <tr key={row.id} className="border-t border-line align-top">
                  <td className="py-2 pr-4 font-mono">{timeFormat.format(new Date(row.createdAt))}</td>
                  <td className="py-2 pr-4">{OWNER_EVENT_LABELS[row.event] ?? row.event}</td>
                  <td className="py-2 pr-4 font-mono">{row.status}</td>
                  <td className="py-2 font-mono">{row.segments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl">Recent messages</h2>
        {log.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="eyebrow text-muted">
                  <th className="py-2 pr-4 font-normal">Time (Colombo)</th>
                  <th className="py-2 pr-4 font-normal">Order</th>
                  <th className="py-2 pr-4 font-normal">Event</th>
                  <th className="py-2 pr-4 font-normal">Status</th>
                  <th className="py-2 pr-4 font-normal">SMS</th>
                  <th className="py-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {log.map((row) => (
                  <tr key={row.id} className="border-t border-line align-top">
                    <td className="py-2 pr-4 font-mono">{timeFormat.format(new Date(row.createdAt))}</td>
                    <td className="py-2 pr-4 font-mono">
                      {row.orderNumber ? (
                        <Link href={`/admin/orders/${row.orderNumber}`} className="underline">
                          {row.orderNumber}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2 pr-4">{EVENT_LABELS[row.event] ?? row.event}</td>
                    <td className="py-2 pr-4 font-mono">{row.status}</td>
                    <td className="py-2 pr-4 font-mono">{row.segments}</td>
                    <td className="py-2">{row.status === "failed" && <ResendButton id={row.id} />}</td>
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
