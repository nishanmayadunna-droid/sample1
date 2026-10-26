"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import {
  createImageUpload,
  getProductForAdmin,
  imageExists,
  insertProduct,
  setProductImage,
  setPublished,
  updateProduct,
} from "@/lib/admin-products";
import {
  imagePathFor,
  isValidImagePath,
  isValidProductId,
  MAX_IMAGE_BYTES,
  parseProductForm,
  type FieldName,
} from "@/lib/product-form";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

export type ProductFormState = {
  errors: Partial<Record<FieldName | "form", string>>;
};

const UPLOAD_FAILED = "Photo upload failed. Try again.";
const SOMETHING_WRONG = "Something went wrong, please try again.";

function revalidateProduct(id: string) {
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  revalidatePath("/cart");
  revalidatePath("/admin");
}

function formFields(formData: FormData): Record<string, string | undefined> {
  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

/**
 * Checks an uploaded photo before anything is written, so a bad photo never
 * leaves a half-saved product behind. True when there is none or it is valid.
 */
async function imageIsUsable(id: string, imagePath: string | undefined): Promise<boolean> {
  if (!imagePath) return true;
  return isValidImagePath(id, imagePath) && (await imageExists(imagePath));
}

export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin("/admin");
  const fields = formFields(formData);
  const parsed = parseProductForm(fields, "create");
  if (!parsed.ok) return { errors: parsed.errors };
  const id = parsed.id!;

  try {
    if (!(await imageIsUsable(id, fields.imagePath))) {
      return { errors: { form: UPLOAD_FAILED } };
    }
    if ((await insertProduct(id, parsed.value)) === "exists") {
      return { errors: { id: "A product with this ID already exists." } };
    }
    if (fields.imagePath) await setProductImage(id, fields.imagePath);
  } catch {
    return { errors: { form: SOMETHING_WRONG } };
  }

  revalidateProduct(id);
  redirect("/admin");
}

export async function updateProductAction(
  id: string,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin(`/admin/products/${id}`);
  if (!(await getProductForAdmin(id))) notFound();
  const fields = formFields(formData);
  const parsed = parseProductForm(fields, "update");
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    if (!(await imageIsUsable(id, fields.imagePath))) {
      return { errors: { form: UPLOAD_FAILED } };
    }
    await updateProduct(id, parsed.value);
    if (fields.imagePath) await setProductImage(id, fields.imagePath);
  } catch {
    return { errors: { form: SOMETHING_WRONG } };
  }

  revalidateProduct(id);
  redirect("/admin");
}

export async function setPublishedAction(id: string, published: boolean): Promise<void> {
  await requireAdmin("/admin");
  await setPublished(id, published);
  revalidateProduct(id);
}

export async function requestImageUpload(
  id: string,
  contentType: string,
  size: number,
): Promise<{ path: string; token: string } | { error: string }> {
  await requireAdmin("/admin");
  const path = isValidProductId(id) ? imagePathFor(id, contentType, Date.now()) : null;
  if (!path || !Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
    return { error: UPLOAD_FAILED };
  }
  try {
    return await createImageUpload(path);
  } catch {
    return { error: UPLOAD_FAILED };
  }
}
