import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { EMAIL_DAILY_CAP } from "@/lib/email";
import { emailConfigured, getEmailSettings, listEmailLog, type EmailLogRow } from "@/lib/email-data";
import AdminTabs from "../AdminTabs";
import EmailSettingsForm from "./EmailSettingsForm";

export const metadata: Metadata = { title: "Admin" };

const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", dateStyle: "medium", timeStyle: "short" });

const KIND_LABELS: Record<EmailLogRow["kind"], string> = {
  order: "Order update",
  reset: "Password reset",
  verify: "Email confirmation",
  newsletter_confirm: "Newsletter confirmation",
};

export default async function AdminEmailPage() {
  await requireAdmin("/admin/email");
  const [settings, log] = await Promise.all([getEmailSettings(), listEmailLog(100).catch((): EmailLogRow[] => [])]);
  const keysSet = emailConfigured();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="email" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Email</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Email is used for password reset links, email confirmation, the newsletter double opt-in and order updates. Every
        email is in English and Sinhala. Links work once and expire (reset: 1 hour, confirmation: 48 hours). At most{" "}
        {EMAIL_DAILY_CAP} emails are sent in 24 hours.
      </p>

      <dl className="mt-6 grid max-w-2xl gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-md border border-line px-4 py-3">
          <dt className="eyebrow text-muted">Provider keys</dt>
          <dd className="mt-1 font-mono">{keysSet ? "set" : "not set"}</dd>
        </div>
        <div className="rounded-md border border-line px-4 py-3">
          <dt className="eyebrow text-muted">Sending</dt>
          <dd className="mt-1 font-mono">{settings.enabled && keysSet ? "on" : "off"}</dd>
        </div>
      </dl>
      <p className="mt-3 max-w-prose text-sm text-muted">
        The keys are the server environment variables RESEND_API_KEY and EMAIL_FROM (for example
        &quot;Your Shop &lt;orders@your-domain&gt;&quot;), in .env.local and in Vercel. The sender address must be on a
        domain you have verified with Resend; until then Resend only delivers to your own address.
      </p>

      <section className="mt-8">
        <h2 className="display text-2xl">Settings</h2>
        <div className="mt-4">
          <EmailSettingsForm settings={settings} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl">Recent emails</h2>
        {log.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="eyebrow text-muted">
                  <th className="py-2 pr-4 font-normal">Time (Colombo)</th>
                  <th className="py-2 pr-4 font-normal">Type</th>
                  <th className="py-2 pr-4 font-normal">To</th>
                  <th className="py-2 pr-4 font-normal">Subject</th>
                  <th className="py-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {log.map((row) => (
                  <tr key={row.id} className="border-t border-line align-top">
                    <td className="py-2 pr-4 font-mono">{timeFormat.format(new Date(row.createdAt))}</td>
                    <td className="py-2 pr-4">{KIND_LABELS[row.kind] ?? row.kind}</td>
                    <td className="py-2 pr-4 font-mono">{row.recipient}</td>
                    <td className="py-2 pr-4">{row.subject}</td>
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
