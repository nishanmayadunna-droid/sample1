import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { getPromotionForAdmin, getPromotionImageUrl } from "@/lib/admin-promotions";
import { updatePromotionAction } from "../actions";
import DeletePromotion from "../DeletePromotion";
import { getPickers } from "../pickers";
import PromotionForm from "../PromotionForm";

export const metadata: Metadata = { title: "Admin" };

export default async function EditPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/promotions/${encodeURIComponent(id)}`);
  const promotion = await getPromotionForAdmin(id);
  if (!promotion) notFound();
  const [imageUrl, { categories, products }] = await Promise.all([
    getPromotionImageUrl(id),
    getPickers(),
  ]);
  const name = promotion.nameEn || promotion.nameSi;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/admin/promotions" className="eyebrow text-muted hover:text-ink">
        ← Promotions
      </Link>
      <h1 className="display mt-2 text-5xl">{name}</h1>
      <div className="measure mt-6 text-ink" />
      <PromotionForm
        mode="update"
        action={updatePromotionAction.bind(null, promotion.id)}
        promotion={promotion}
        existingImageUrl={imageUrl}
        categories={categories}
        products={products}
      />
      <DeletePromotion id={promotion.id} slug={promotion.slug} name={name} />
    </div>
  );
}
