// Server-side promotion management for /admin/promotions: every promotion
// (including inactive and finished ones), writes and banner uploads. Uses the
// secret-key client; callers must check requireAdmin() first
// (app/admin/promotions/actions.ts does).
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PromotionInput, RuleInput } from "@/lib/promotion-form";
import { PROMOTION_COLUMNS, toPromotion, type Promotion, type PromotionRow } from "@/lib/promotions";

const BUCKET = "promotion-images";
// Postgres error codes.
const UNIQUE_VIOLATION = "23505";
const INVALID_TEXT = "22P02";

function fail(error: unknown): never {
  console.error("admin promotions query failed", error);
  throw new Error("admin promotions query failed");
}

export async function listPromotionsForAdmin(): Promise<Promotion[]> {
  const { data, error } = await supabaseAdmin
    .from("promotions")
    .select(PROMOTION_COLUMNS)
    .order("sort_order")
    .order("starts_at", { ascending: false })
    .returns<PromotionRow[]>();
  if (error) fail(error);
  return data.map(toPromotion);
}

/** The promotion with this id, or null (also for an id that isn't a uuid). */
export async function getPromotionForAdmin(id: string): Promise<Promotion | null> {
  const { data, error } = await supabaseAdmin
    .from("promotions")
    .select(PROMOTION_COLUMNS)
    .eq("id", id)
    .maybeSingle<PromotionRow>();
  if (error?.code === INVALID_TEXT) return null;
  if (error) fail(error);
  return data ? toPromotion(data) : null;
}

/** The raw image URL, kept separately because an image banner's URL is in `banner`. */
export async function getPromotionImageUrl(id: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("promotions")
    .select("image_url")
    .eq("id", id)
    .maybeSingle<{ image_url: string | null }>();
  if (error) fail(error);
  return data?.image_url ?? null;
}

export async function insertPromotion(
  slug: string,
  value: PromotionInput,
): Promise<{ id: string } | "exists"> {
  const { data, error } = await supabaseAdmin
    .from("promotions")
    .insert({ slug, ...value })
    .select("id")
    .single<{ id: string }>();
  if (error?.code === UNIQUE_VIOLATION) return "exists";
  if (error) fail(error);
  return data;
}

export async function updatePromotion(id: string, value: PromotionInput): Promise<void> {
  const { error } = await supabaseAdmin.from("promotions").update(value).eq("id", id);
  if (error) fail(error);
}

/** Replaces the promotion's rules in one transaction (save_promotion_rules). */
export async function savePromotionRules(id: string, rules: RuleInput[]): Promise<void> {
  const { error } = await supabaseAdmin.rpc("save_promotion_rules", {
    p_promotion_id: id,
    p_rules: rules.map((rule, i) => ({ ...rule, sort_order: i })),
  });
  if (error) fail(error);
}

/** The object path inside the bucket for one of its public URLs, else null. */
function bucketPathOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  try {
    return decodeURIComponent(url.slice(index + marker.length));
  } catch {
    return null;
  }
}

async function removeImage(path: string | null): Promise<void> {
  if (!path) return;
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (error) console.error("promotion image not removed", path, error);
}

/** Deletes the promotion (rules cascade), then best-effort its photo. */
export async function deletePromotion(id: string): Promise<void> {
  const imageUrl = await getPromotionImageUrl(id);
  const { error } = await supabaseAdmin.from("promotions").delete().eq("id", id);
  if (error) fail(error);
  await removeImage(bucketPathOf(imageUrl));
}

/** A one-time signed URL the browser uploads `path` to directly. */
export async function createPromotionImageUpload(
  path: string,
): Promise<{ path: string; token: string }> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) fail(error);
  return { path: data.path, token: data.token };
}

export async function promotionImageExists(path: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .list("", { search: path, limit: 100 });
  if (error) fail(error);
  return data.some((file) => file.name === path);
}

/** Points the promotion at `path`, then best-effort deletes its previous photo. */
export async function setPromotionImage(id: string, path: string): Promise<void> {
  const previous = await getPromotionImageUrl(id);
  const publicUrl = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await supabaseAdmin.from("promotions").update({ image_url: publicUrl }).eq("id", id);
  if (error) fail(error);
  const oldPath = bucketPathOf(previous);
  if (oldPath !== path) await removeImage(oldPath);
}
