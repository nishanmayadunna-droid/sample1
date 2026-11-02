"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import {
  countVisiblePromises,
  deletePromise,
  getPromiseForAdmin,
  insertPromise,
  movePromise,
  setPromiseVisible,
  updatePromise,
} from "@/lib/admin-storefront";
import {
  canShowPromise,
  MAX_VISIBLE_PROMISES,
  parsePromiseForm,
  type PromiseFieldName,
} from "@/lib/storefront-form";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

export type PromiseFormState = { errors: Partial<Record<PromiseFieldName, string>> };
export type PromiseRowState = { error: string | null };

const SOMETHING_WRONG = "Something went wrong, please try again.";

// Promises are read by the root layout (strip and footer), i.e. every page.
function revalidatePromises() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/promises");
}

function formFields(formData: FormData): Record<string, string | undefined> {
  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

export async function createPromiseAction(
  _prev: PromiseFormState,
  formData: FormData,
): Promise<PromiseFormState> {
  await requireAdmin("/admin/promises/new");
  try {
    const parsed = parsePromiseForm(formFields(formData), await countVisiblePromises());
    if (!parsed.ok) return { errors: parsed.errors };
    await insertPromise(parsed.value);
  } catch {
    return { errors: { form: SOMETHING_WRONG } };
  }
  revalidatePromises();
  redirect("/admin/promises");
}

export async function updatePromiseAction(
  id: string,
  _prev: PromiseFormState,
  formData: FormData,
): Promise<PromiseFormState> {
  await requireAdmin(`/admin/promises/${id}`);
  if (!(await getPromiseForAdmin(id))) notFound();
  try {
    const parsed = parsePromiseForm(formFields(formData), await countVisiblePromises(id));
    if (!parsed.ok) return { errors: parsed.errors };
    await updatePromise(id, parsed.value);
  } catch {
    return { errors: { form: SOMETHING_WRONG } };
  }
  revalidatePromises();
  redirect("/admin/promises");
}

export async function setPromiseVisibleAction(
  id: string,
  visible: boolean,
): Promise<PromiseRowState> {
  await requireAdmin("/admin/promises");
  try {
    if (visible && !canShowPromise(await countVisiblePromises(id))) {
      return { error: `Only ${MAX_VISIBLE_PROMISES} promises can be shown at once. Hide one first.` };
    }
    await setPromiseVisible(id, visible);
  } catch {
    return { error: SOMETHING_WRONG };
  }
  revalidatePromises();
  return { error: null };
}

export async function movePromiseAction(
  id: string,
  direction: "up" | "down",
): Promise<PromiseRowState> {
  await requireAdmin("/admin/promises");
  try {
    await movePromise(id, direction);
  } catch {
    return { error: SOMETHING_WRONG };
  }
  revalidatePromises();
  return { error: null };
}

export async function deletePromiseAction(id: string): Promise<PromiseRowState> {
  await requireAdmin("/admin/promises");
  try {
    await deletePromise(id);
  } catch {
    return { error: SOMETHING_WRONG };
  }
  revalidatePromises();
  return { error: null };
}
