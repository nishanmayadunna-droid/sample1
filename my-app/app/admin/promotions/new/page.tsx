import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { createPromotionAction } from "../actions";
import { getPickers } from "../pickers";
import PromotionForm from "../PromotionForm";

export const metadata: Metadata = { title: "Admin" };

export default async function NewPromotionPage() {
  await requireAdmin("/admin/promotions/new");
  const { categories, products } = await getPickers();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/admin/promotions" className="eyebrow text-muted hover:text-ink">
        ← Promotions
      </Link>
      <h1 className="display mt-2 text-5xl">New promotion</h1>
      <div className="measure mt-6 text-ink" />
      <PromotionForm
        mode="create"
        action={createPromotionAction}
        existingImageUrl={null}
        categories={categories}
        products={products}
      />
    </div>
  );
}
