// Pure rules for a product's photo gallery. No I/O: shared by the catalog, the
// admin form, the Server Actions and the unit tests.
import { isValidImagePath } from "./product-form";

export const MAX_PHOTOS = 5;

/** Public URL of a file in the `product-images` bucket. */
export function publicPhotoUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/product-images/${encodeURIComponent(path)}`;
}

/** Photo paths in display order. */
export function sortedPhotoPaths(
  rows: { path: string; sort_order: number }[] | null | undefined,
): string[] {
  return [...(rows ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((row) => row.path);
}

/**
 * Gallery URLs, main photo first: the product's photo rows, else its legacy
 * `image_url`, else none (the page shows the swatch).
 */
export function galleryUrls(
  supabaseUrl: string,
  paths: string[],
  imageUrl: string | null,
): string[] {
  if (paths.length > 0) return paths.map((path) => publicPhotoUrl(supabaseUrl, path));
  return imageUrl ? [imageUrl] : [];
}

/**
 * `existing` are the paths the product already stores: they were accepted
 * before (seed photos are named `<id>.jpg`, not `<id>-<epoch>.<ext>`), so only
 * new paths must match the upload naming rule.
 */
export function validatePhotoList(
  id: string,
  paths: string[],
  existing: string[] = [],
): "ok" | "too-many" | "duplicate" | "invalid-path" {
  if (paths.length > MAX_PHOTOS) return "too-many";
  if (!paths.every((path) => existing.includes(path) || isValidImagePath(id, path))) {
    return "invalid-path";
  }
  if (new Set(paths).size !== paths.length) return "duplicate";
  return "ok";
}

/** A copy of `items` with one item moved; out-of-range indexes change nothing. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const copy = [...items];
  if (from < 0 || from >= copy.length || to < 0 || to >= copy.length) return copy;
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/** The form's `photos` field: a JSON array of storage paths, or null if malformed. */
export function parsePhotosField(raw: string | undefined): string[] | null {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every((v) => typeof v === "string")
      ? (value as string[])
      : null;
  } catch {
    return null;
  }
}
