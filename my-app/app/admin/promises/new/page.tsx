import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { createPromiseAction } from "../actions";
import PromiseForm from "../PromiseForm";

export const metadata: Metadata = { title: "Admin" };

export default async function NewPromisePage() {
  await requireAdmin("/admin/promises/new");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/admin/promises" className="eyebrow text-muted hover:text-ink">
        ← Promises
      </Link>
      <h1 className="display mt-2 text-5xl">New promise</h1>
      <div className="measure mt-6 text-ink" />
      <PromiseForm action={createPromiseAction} />
    </div>
  );
}
