// Server-side product management for /admin: every product including hidden
// ones, writes, and photo uploads. Uses the secret-key client; callers must
// check requireAdmin() first (app/admin/products/actions.ts does).
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { COLUMNS, getCategories, toProduct, type ProductRow } from "@/lib/catalog";
import type { ProductInput } from "@/lib/product-form";
import { publicPhotoUrl, sortedPhotoPaths } from "@/lib/product-photos";
import type { Category, Product } from "@/lib/products";

export type AdminProduct = Product & {
  published: boolean;
  sortOrder: number;
  /** Storage paths of the gallery photos, main photo first. */
  photoPaths: string[];
};

const BUCKET = "product-images";
const ADMIN_COLUMNS = `${COLUMNS}, published, sort_order`;
// Postgres unique_violation: a product with this id already exists.
const UNIQUE_VIOLATION = "23505";

type AdminRow = ProductRow & { published: boolean; sort_order: number };

function toAdminProduct(row: AdminRow, categories: Category[]): AdminProduct {
  return {
    ...toProduct(row, categories),
    published: row.published,
    sortOrder: row.sort_order,
    photoPaths: sortedPhotoPaths(row.product_images),
  };
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
  const categories = await getCategories();
  return data.map((row) => toAdminProduct(row, categories));
}

export async function getProductForAdmin(id: string): Promise<AdminProduct | null> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(ADMIN_COLUMNS)
    .eq("id", id)
    .maybeSingle<AdminRow>();
  if (error) fail(error);
  return data ? toAdminProduct(data, await getCategories()) : null;
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

/** `stock` is left out when the save must not touch it (see planStockSave). */
export async function updateProduct(
  id: string,
  input: Omit<ProductInput, "stock"> & { stock?: ProductInput["stock"] },
): Promise<void> {
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
  if (index === -1) return null;
  try {
    return decodeURIComponent(url.slice(index + marker.length));
  } catch {
    return null; // a hand-edited URL with a broken %-escape: leave the file alone
  }
}

/**
 * Permanently deletes the product row, then best-effort deletes its photo.
 * Returns false when no product had this id. Cart lines that still point at
 * it are harmless: the shop skips ids it can't find.
 */
export async function deleteProduct(id: string): Promise<boolean> {
  // The rows cascade away with the product, so read the photo paths first.
  const { data: photoRows } = await supabaseAdmin
    .from("product_images")
    .select("path")
    .eq("product_id", id)
    .returns<{ path: string }[]>();
  const { data, error } = await supabaseAdmin
    .from("products")
    .delete()
    .eq("id", id)
    .select("image_url")
    .returns<{ image_url: string | null }[]>();
  if (error) fail(error);
  if (data.length === 0) return false;

  const photoPaths = new Set((photoRows ?? []).map((row) => row.path));
  const legacyPath = bucketPathOf(data[0].image_url);
  if (legacyPath) photoPaths.add(legacyPath);
  if (photoPaths.size > 0) {
    const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove([...photoPaths]);
    if (removeError) console.error("deleted product's images not removed", [...photoPaths], removeError);
  }
  return true;
}

/**
 * Replaces the product's gallery with `paths` (main photo first), keeps
 * products.image_url equal to the first photo, then best-effort deletes the
 * files that are no longer used.
 */
export async function setProductPhotos(id: string, paths: string[]): Promise<void> {
  const { data: current, error: readError } = await supabaseAdmin
    .from("product_images")
    .select("path, sort_order")
    .eq("product_id", id)
    .order("sort_order")
    .returns<{ path: string; sort_order: number }[]>();
  if (readError) fail(readError);
  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("image_url")
    .eq("id", id)
    .maybeSingle<{ image_url: string | null }>();
  if (productError) fail(productError);

  const { error: deleteError } = await supabaseAdmin
    .from("product_images")
    .delete()
    .eq("product_id", id);
  if (deleteError) fail(deleteError);
  if (paths.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("product_images")
      .insert(paths.map((path, index) => ({ product_id: id, path, sort_order: index })));
    if (insertError) {
      // Put the old photos back so a failed save never leaves the product with none.
      const { error: restoreError } = await supabaseAdmin.from("product_images").insert(
        current.map((row) => ({ product_id: id, path: row.path, sort_order: row.sort_order })),
      );
      if (restoreError) console.error("product photos not restored", id, restoreError);
      fail(insertError);
    }
  }

  const imageUrl =
    paths.length > 0 ? publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, paths[0]) : null;
  const { error } = await supabaseAdmin.from("products").update({ image_url: imageUrl }).eq("id", id);
  if (error) fail(error);

  const old = new Set([...current.map((row) => row.path)]);
  const legacy = bucketPathOf(product?.image_url);
  if (legacy) old.add(legacy);
  const removed = [...old].filter((path) => !paths.includes(path));
  if (removed.length > 0) {
    const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove(removed);
    if (removeError) console.error("old product photos not removed", removed, removeError);
  }
}
