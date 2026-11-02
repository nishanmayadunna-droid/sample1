"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import {
  deleteCategory,
  getCategoryForAdmin,
  insertCategory,
  updateCategory,
} from "@/lib/admin-categories";
import { parseCategoryForm, type CategoryFieldName } from "@/lib/category-form";
import { isDeleteConfirmed } from "@/lib/product-form";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

export type CategoryFormState = {
  errors: Partial<Record<CategoryFieldName | "form", string>>;
};
export type DeleteCategoryState = { error: string | null };

const SOMETHING_WRONG = "Something went wrong, please try again.";
const NAME_TAKEN = "Another category already uses this name.";

function revalidateCategories() {
  // The root layout passes categories to the menu and footer, and products to the shell.
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/products");
  // Category names appear on every product page.
  revalidatePath("/products/[id]", "page");
  revalidatePath("/cart");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
}

function formFields(formData: FormData): Record<string, string | undefined> {
  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

export async function createCategoryAction(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin("/admin/categories/new");
  const parsed = parseCategoryForm(formFields(formData), "create");
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    const result = await insertCategory(parsed.slug!, parsed.value);
    if (result === "slug_taken") {
      return { errors: { slug: "A category with this slug already exists." } };
    }
    if (result === "name_taken") return { errors: { name: NAME_TAKEN } };
  } catch {
    return { errors: { form: SOMETHING_WRONG } };
  }

  revalidateCategories();
  redirect("/admin/categories");
}

export async function updateCategoryAction(
  slug: string,
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin(`/admin/categories/${slug}`);
  const parsed = parseCategoryForm(formFields(formData), "update");
  if (!parsed.ok) return { errors: parsed.errors };

  let found: boolean;
  try {
    found = (await getCategoryForAdmin(slug)) !== null;
    if (found && (await updateCategory(slug, parsed.value)) === "name_taken") {
      return { errors: { name: NAME_TAKEN } };
    }
  } catch {
    return { errors: { form: SOMETHING_WRONG } };
  }
  if (!found) notFound();

  revalidateCategories();
  redirect("/admin/categories");
}

export async function deleteCategoryAction(
  slug: string,
  _prev: DeleteCategoryState,
  formData: FormData,
): Promise<DeleteCategoryState> {
  await requireAdmin(`/admin/categories/${slug}`);
  const typed = formData.get("confirmation");
  if (typeof typed !== "string" || !isDeleteConfirmed(slug, typed)) {
    return { error: "Type the category slug to confirm." };
  }

  let result: Awaited<ReturnType<typeof deleteCategory>>;
  try {
    result = await deleteCategory(slug);
  } catch {
    return { error: SOMETHING_WRONG };
  }
  if ("blocked" in result) {
    const n = result.blocked;
    return {
      error: `This category has ${n} ${n === 1 ? "product" : "products"}. Move or delete them first.`,
    };
  }
  if (!result.deleted) notFound();

  revalidateCategories();
  redirect("/admin/categories");
}
