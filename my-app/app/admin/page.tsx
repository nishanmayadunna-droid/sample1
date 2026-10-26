import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin("/admin");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Admin</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-8 text-muted">Products management coming soon</p>
    </div>
  );
}
