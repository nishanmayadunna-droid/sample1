// Server-side product management for /admin: every product including hidden
// ones, writes, and photo uploads. Uses the secret-key client; callers must
// check requireAdmin() first (app/admin/products/actions.ts does).
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { COLUMNS, toProduct, type ProductRow } from "@/lib/catalog";
import type { ProductInput } from "@/lib/product-form";
import type { Product } from "@/lib/products";

export type AdminProduct = Product & { published: boolean; sortOrder: number };

const BUCKET = "product-images";
const ADMIN_COLUMNS = `${COLUMNS}, published, sort_order`;
// Postgres unique_violation: a product with this id already exists.
const UNIQUE_VIOLATION = "23505";

type AdminRow = ProductRow & { published: boolean; sort_order: number };

function toAdminProduct(row: AdminRow): AdminProduct {
  return { ...toProduct(row), published: row.published, sortOrder: row.sort_order };
}

function fail(error: unknown): never {
  console.error("admin products query failed", error);
  throw new Error("admin products query failed");
}

export async function listProductsForAdmin(): Promise<AdminProduct[]> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(ADMIN_COLUMNS)
    .order("sort_order")
    .order("name")
    .returns<AdminRow[]>();
  if (error) fail(error);
  return data.map(toAdminProduct);
}

export async function getProductForAdmin(id: string): Promise<AdminProduct | null> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(ADMIN_COLUMNS)
    .eq("id", id)
    .maybeSingle<AdminRow>();
  if (error) fail(error);
  return data ? toAdminProduct(data) : null;
}

export async function insertProduct(
  id: string,
  input: ProductInput,
): Promise<"ok" | "exists"> {
  const { error } = await supabaseAdmin.from("products").insert({ id, ...input });
  if (error?.code === UNIQUE_VIOLATION) return "exists";
  if (error) fail(error);
  return "ok";
}

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  const { error } = await supabaseAdmin.from("products").update(input).eq("id", id);
  if (error) fail(error);
}

export async function setPublished(id: string, published: boolean): Promise<void> {
  const { error } = await supabaseAdmin
    .from("products")
    .update({ published })
    .eq("id", id);
  if (error) fail(error);
}

/** A one-time signed URL the browser uploads `path` to directly. */
export async function createImageUpload(
  path: string,
): Promise<{ path: string; token: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error) fail(error);
  return { path: data.path, token: data.token };
}

export async function imageExists(path: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .list("", { search: path, limit: 100 });
  if (error) fail(error);
  return data.some((file) => file.name === path);
}

/** The object path inside the bucket for one of its public URLs, else null. */
function bucketPathOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length));
}

/** Points the product at `path`, then best-effort deletes its previous photo. */
export async function setProductImage(id: string, path: string): Promise<void> {
  const { data: current, error: readError } = await supabaseAdmin
    .from("products")
    .select("image_url")
    .eq("id", id)
    .maybeSingle<{ image_url: string | null }>();
  if (readError) fail(readError);

  const publicUrl = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await supabaseAdmin
    .from("products")
    .update({ image_url: publicUrl })
    .eq("id", id);
  if (error) fail(error);

  const oldPath = bucketPathOf(current?.image_url);
  if (oldPath && oldPath !== path) {
    const { error: removeError } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([oldPath]);
    if (removeError) console.error("old product image not removed", oldPath, removeError);
  }
}
