"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { BRAND_SLOTS, isBrandImage, isValidBrandPath, validateBrandForm, type BrandSlot } from "@/lib/brand";
import { brandImageExists, createBrandUpload, deleteBrandFile, saveBrand, setBrandImagePath } from "@/lib/admin-brand";

// Every action re-checks admin access first: Server Actions are endpoints of their own.

export type BrandFormState = { errors: string[]; saved: boolean };

function refresh() {
  // The brand shows on every page (header, footer, theme, metadata), so a save must reach all of them.
  revalidatePath("/", "layout");
  revalidatePath("/admin/branding");
}

const isSlot = (value: unknown): value is BrandSlot => typeof value === "string" && (BRAND_SLOTS as readonly string[]).includes(value);

export async function saveBrandAction(_prev: BrandFormState, formData: FormData): Promise<BrandFormState> {
  await requireAdmin("/admin/branding");
  const parsed = validateBrandForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, saved: false };
  try {
    await saveBrand(parsed.value);
  } catch {
    return { errors: ["server"], saved: false };
  }
  refresh();
  return { errors: [], saved: true };
}

/** A signed upload URL for one image slot; the type and size are checked here, not trusted from the browser. */
export async function requestBrandUpload(
  slot: BrandSlot,
  contentType: string,
  size: number,
): Promise<{ path: string; token: string } | { error: "bad_file" | "error" }> {
  await requireAdmin("/admin/branding");
  if (!isSlot(slot) || typeof contentType !== "string" || typeof size !== "number" || !isBrandImage(contentType, size)) {
    return { error: "bad_file" };
  }
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  try {
    return await createBrandUpload(`${Date.now()}-${slot}.${ext}`);
  } catch {
    return { error: "error" };
  }
}

/** Saves an uploaded image into its slot (or clears the slot to go back to the default). */
export async function saveBrandImageAction(slot: BrandSlot, path: string | null): Promise<"ok" | "bad_file" | "error"> {
  await requireAdmin("/admin/branding");
  if (!isSlot(slot)) return "bad_file";
  if (path !== null && (typeof path !== "string" || !isValidBrandPath(path) || !path.includes(`-${slot}.`))) return "bad_file";
  try {
    if (path !== null && !(await brandImageExists(path))) return "bad_file";
    const previous = await setBrandImagePath(slot, path);
    if (previous && previous !== path) await deleteBrandFile(previous);
  } catch {
    return "error";
  }
  refresh();
  return "ok";
}
