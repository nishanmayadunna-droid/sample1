import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { countSentToday, getSmsSettings } from "@/lib/sms-data";
import { smsTokenSet } from "@/lib/sms";
import AdminTabs from "../AdminTabs";
import SmsSettingsForm from "./SmsSettingsForm";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminSmsPage() {
  await requireAdmin("/admin/sms");
  const [settings, sentToday] = await Promise.all([getSmsSettings(), countSentToday()]);
  const tokenSet = smsTokenSet();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="sms" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">SMS</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Customers can sign in with a phone number and a six-digit code sent by SMS. Each code costs about Rs 1, so the
        daily limit caps how much can be spent in a day.
      </p>

      <dl className="mt-6 grid max-w-2xl gap-4 text-sm sm:grid-cols-2">
        <div className="rounded-md border border-line px-4 py-3">
          <dt className="eyebrow text-muted">Sent today</dt>
          <dd className="mt-1 font-mono">
            {sentToday} of {settings.dailyCap}
          </dd>
        </div>
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
        <SmsSettingsForm settings={settings} />
      </section>
    </div>
  );
}
