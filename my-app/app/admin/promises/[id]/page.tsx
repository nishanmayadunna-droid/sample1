import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { getPromiseForAdmin } from "@/lib/admin-storefront";
import { updatePromiseAction } from "../actions";
import PromiseForm from "../PromiseForm";

export const metadata: Metadata = { title: "Admin" };

export default async function EditPromisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin(`/admin/promises/${encodeURIComponent(id)}`);
  const promise = await getPromiseForAdmin(id);
  if (!promise) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/admin/promises" className="eyebrow text-muted hover:text-ink">
        ← Promises
      </Link>
      <h1 className="display mt-2 text-5xl">Edit promise</h1>
      <div className="measure mt-6 text-ink" />
      <PromiseForm action={updatePromiseAction.bind(null, promise.id)} promise={promise} />
    </div>
  );
}
