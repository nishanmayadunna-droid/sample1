// Admin-side writes for the shop's brand (secret-key client).
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { BrandRow, BrandSlot } from "./brand";

const BUCKET = "brand-assets";

const COLUMN: Record<BrandSlot, string> = {
  logo: "logo_path",
  logoDark: "logo_dark_path",
  favicon: "favicon_path",
  share: "share_image_path",
};

function fail(error: unknown): never {
  console.error("brand admin query failed", error);
  throw new Error("brand admin query failed");
}

export async function saveBrand(value: BrandRow): Promise<void> {
  const { error } = await supabaseAdmin
    .from("store_brand")
    .upsert({ id: true, ...value, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) fail(error);
}

export async function createBrandUpload(path: string): Promise<{ path: string; token: string }> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) fail(error);
  return { path: data.path, token: data.token };
}

export async function brandImageExists(path: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list("", { search: path, limit: 100 });
  if (error) fail(error);
  return data.some((file) => file.name === path);
}

/** Sets (or clears) one image slot and returns the previous path so the caller can clean it up. */
export async function setBrandImagePath(slot: BrandSlot, path: string | null): Promise<string | null> {
  const column = COLUMN[slot];
  const { data, error: readError } = await supabaseAdmin.from("store_brand").select(column).maybeSingle();
  if (readError) fail(readError);
  const before = (data as Record<string, string | null> | null)?.[column] ?? null;
  const { error } = await supabaseAdmin
    .from("store_brand")
    .upsert({ id: true, [column]: path, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) fail(error);
  return before;
}

export async function deleteBrandFile(path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (error) console.error("brand file cleanup failed", error.message);
}
