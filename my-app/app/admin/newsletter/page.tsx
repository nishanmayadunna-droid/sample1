import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { listSubscribers } from "@/lib/newsletter-data";
import AdminTabs from "../AdminTabs";
import DeleteSubscriberButton from "./DeleteSubscriberButton";

export const metadata: Metadata = { title: "Admin" };

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Colombo",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminNewsletterPage() {
  await requireAdmin("/admin/newsletter");
  const list = await listSubscribers(200).catch(() => null);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="newsletter" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Newsletter</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Emails collected from the signup form in the footer. No emails are sent from here yet; export the list as CSV
        when you are ready to use it.
      </p>

      {list === null ? (
        <p role="alert" className="mt-6 text-sm text-blaze">
          Could not load subscribers. Try again in a moment.
        </p>
      ) : (
        <>
          <dl className="mt-6 grid max-w-2xl gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-md border border-line px-4 py-3">
              <dt className="eyebrow text-muted">Active</dt>
              <dd className="mt-1 font-mono">{list.active}</dd>
            </div>
            <div className="rounded-md border border-line px-4 py-3">
              <dt className="eyebrow text-muted">Unsubscribed</dt>
              <dd className="mt-1 font-mono">{list.unsubscribed}</dd>
            </div>
          </dl>

          <p className="mt-6">
            <a
              href="/admin/newsletter/export"
              className="rounded-full border border-line px-4 py-2 font-mono text-[0.7rem] uppercase tracking-[0.12em] hover:border-ink"
            >
              Export CSV
            </a>
          </p>

          <section className="mt-10">
            <h2 className="display text-2xl">Latest subscribers</h2>
            {list.rows.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Nobody yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="eyebrow text-muted">
                      <th className="py-2 pr-4 font-normal">Email</th>
                      <th className="py-2 pr-4 font-normal">Source</th>
                      <th className="py-2 pr-4 font-normal">Subscribed (Colombo)</th>
                      <th className="py-2 pr-4 font-normal">Status</th>
                      <th className="py-2 font-normal" />
                    </tr>
                  </thead>
                  <tbody>
                    {list.rows.map((row) => (
                      <tr key={row.id} className="border-t border-line align-top">
                        <td className="py-2 pr-4 font-mono">{row.email}</td>
                        <td className="py-2 pr-4">{row.source}</td>
                        <td className="py-2 pr-4 font-mono">{timeFormat.format(new Date(row.createdAt))}</td>
                        <td className="py-2 pr-4 font-mono">{row.unsubscribedAt ? "unsubscribed" : "active"}</td>
                        <td className="py-2">
                          <DeleteSubscriberButton id={row.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
