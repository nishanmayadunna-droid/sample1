"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import {
  createPromotionImageUpload,
  deletePromotion,
  getPromotionForAdmin,
  insertPromotion,
  promotionImageExists,
  savePromotionRules,
  setPromotionImage,
  updatePromotion,
} from "@/lib/admin-promotions";
import { imagePathFor, isDeleteConfirmed, isValidImagePath, MAX_IMAGE_BYTES } from "@/lib/product-form";
import { parsePromotionForm, type PromotionFieldName } from "@/lib/promotion-form";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

export type PromotionFormState = { errors: Partial<Record<PromotionFieldName, string>> };
export type DeletePromotionState = { error: string | null };

const SOMETHING_WRONG = "Something went wrong, please try again.";
const UPLOAD_FAILED = "Banner upload failed. Try again.";

// Promotions price every page and the cart drawer (root layout).
function revalidatePromotions() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/promotions");
}

function formFields(formData: FormData): Record<string, string | undefined> {
  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

/**
 * Checks an uploaded banner before anything is written. Banner files are
 * named after the promotion's slug, which never changes.
 */
async function imageIsUsable(slug: string, imagePath: string | undefined): Promise<boolean> {
  if (!imagePath) return true;
  return isValidImagePath(slug, imagePath) && (await promotionImageExists(imagePath));
}

export async function createPromotionAction(
  _prev: PromotionFormState,
  formData: FormData,
): Promise<PromotionFormState> {
  await requireAdmin("/admin/promotions/new");
  const fields = formFields(formData);
  const parsed = parsePromotionForm(fields, "create");
  if (!parsed.ok) return { errors: parsed.errors };
  const slug = parsed.slug!;

  try {
    if (!(await imageIsUsable(slug, fields.imagePath))) return { errors: { banner: UPLOAD_FAILED } };
    const created = await insertPromotion(slug, parsed.value);
    if (created === "exists") return { errors: { slug: "A promotion with this slug already exists." } };
    try {
      await savePromotionRules(created.id, parsed.rules);
      if (fields.imagePath) await setPromotionImage(created.id, fields.imagePath);
    } catch (error) {
      // Don't leave a half-saved promotion behind.
      await deletePromotion(created.id).catch(() => {});
      throw error;
    }
  } catch {
    return { errors: { form: SOMETHING_WRONG } };
  }

  revalidatePromotions();
  redirect("/admin/promotions");
}

export async function updatePromotionAction(
  id: string,
  _prev: PromotionFormState,
  formData: FormData,
): Promise<PromotionFormState> {
  await requireAdmin(`/admin/promotions/${id}`);
  const existing = await getPromotionForAdmin(id);
  if (!existing) notFound();
  const fields = formFields(formData);
  const parsed = parsePromotionForm(fields, "update");
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    if (!(await imageIsUsable(existing.slug, fields.imagePath))) {
      return { errors: { banner: UPLOAD_FAILED } };
    }
    await updatePromotion(id, parsed.value);
    await savePromotionRules(id, parsed.rules);
    if (fields.imagePath) await setPromotionImage(id, fields.imagePath);
  } catch {
    return { errors: { form: SOMETHING_WRONG } };
  }

  revalidatePromotions();
  redirect("/admin/promotions");
}

export async function deletePromotionAction(
  id: string,
  _prev: DeletePromotionState,
  formData: FormData,
): Promise<DeletePromotionState> {
  await requireAdmin(`/admin/promotions/${id}`);
  const existing = await getPromotionForAdmin(id);
  if (!existing) notFound();
  if (!isDeleteConfirmed(existing.slug, String(formData.get("confirm") ?? ""))) {
    return { error: `Type ${existing.slug} to confirm.` };
  }
  try {
    await deletePromotion(id);
  } catch {
    return { error: SOMETHING_WRONG };
  }
  revalidatePromotions();
  redirect("/admin/promotions");
}

/** A signed upload URL for a banner image named after the promotion's slug. */
export async function requestPromotionImageUpload(
  slug: string,
  contentType: string,
  size: number,
): Promise<{ path: string; token: string } | { error: string }> {
  await requireAdmin("/admin/promotions");
  const path = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 60
    ? imagePathFor(slug, contentType, Date.now())
    : null;
  if (!path || !Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
    return { error: UPLOAD_FAILED };
  }
  try {
    return await createPromotionImageUpload(path);
  } catch {
    return { error: UPLOAD_FAILED };
  }
}
