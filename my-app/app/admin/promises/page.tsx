import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { listPromisesForAdmin } from "@/lib/admin-storefront";
import { MAX_VISIBLE_PROMISES } from "@/lib/storefront-form";
import PromiseIcon from "@/app/components/PromiseIcon";
import AdminTabs from "../AdminTabs";
import PromiseRowActions from "./PromiseRowActions";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPromisesPage() {
  await requireAdmin("/admin/promises");
  const promises = await listPromisesForAdmin();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="promises" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted">Staff only</p>
          <h1 className="display mt-2 text-5xl">Promises</h1>
        </div>
        <Link
          href="/admin/promises/new"
          className="rounded-full bg-blaze px-6 py-3 font-medium text-onaccent transition-transform hover:-translate-y-0.5"
        >
          New promise
        </Link>
      </div>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Shown in the black strip at the top of the shop and in the footer, after the
        free-shipping line. Up to {MAX_VISIBLE_PROMISES} can be visible at once.
      </p>

      {promises.length === 0 ? (
        <p className="mt-8 text-muted">No promises yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {promises.map((promise, i) => (
            <li key={promise.id} className="flex flex-wrap items-center gap-4 py-4">
              <PromiseIcon icon={promise.icon} className="h-5 w-5 text-blaze" />
              <div className="min-w-48 flex-1">
                <p>{promise.textSi || <span className="text-muted">— no Sinhala —</span>}</p>
                <p className="text-sm text-muted">{promise.textEn || "— no English —"}</p>
              </div>
              <span
                className={`font-mono text-[0.7rem] uppercase tracking-[0.14em] ${
                  promise.visible ? "text-blaze" : "text-muted"
                }`}
              >
                {promise.visible ? "Visible" : "Hidden"}
              </span>
              <PromiseRowActions
                promise={promise}
                isFirst={i === 0}
                isLast={i === promises.length - 1}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
