"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { saveLanguageSettings, saveShippingSettings } from "@/lib/admin-storefront";
import { saveStoreContact } from "@/lib/admin-store-contact";
import { parseContactForm } from "@/lib/store-contact";
import { parseLanguageSettings, parseShippingSettings } from "@/lib/storefront-form";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

export type LanguageSettingsState = {
  errors: { defaultLang?: string; form?: string };
  saved: boolean;
};

function formFields(formData: FormData): Record<string, string | undefined> {
  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

export async function saveLanguageSettingsAction(
  _prev: LanguageSettingsState,
  formData: FormData,
): Promise<LanguageSettingsState> {
  await requireAdmin("/admin/settings");
  const parsed = parseLanguageSettings(formFields(formData));
  if (!parsed.ok) return { errors: parsed.errors, saved: false };

  try {
    await saveLanguageSettings(parsed.value);
  } catch {
    return { errors: { form: "Something went wrong, please try again." }, saved: false };
  }

  // The language settings are read by the root layout, i.e. every page.
  revalidatePath("/", "layout");
  return { errors: {}, saved: true };
}

export type ShippingSettingsState = {
  errors: { shippingFee?: string; form?: string };
  saved: boolean;
};

export async function saveShippingSettingsAction(
  _prev: ShippingSettingsState,
  formData: FormData,
): Promise<ShippingSettingsState> {
  await requireAdmin("/admin/settings");
  const parsed = parseShippingSettings(formFields(formData));
  if (!parsed.ok) return { errors: parsed.errors, saved: false };

  try {
    await saveShippingSettings(parsed.value);
  } catch {
    return { errors: { form: "Something went wrong, please try again." }, saved: false };
  }

  // The fee is read by the root layout (cart drawer) and /cart.
  revalidatePath("/", "layout");
  return { errors: {}, saved: true };
}

export type ContactSettingsState = {
  errors: Record<string, string>;
  saved: boolean;
};

const STORE_PAGE_PATHS = ["/about", "/contact", "/privacy", "/terms", "/returns", "/size-guide"];

export async function saveContactAction(
  _prev: ContactSettingsState,
  formData: FormData,
): Promise<ContactSettingsState> {
  await requireAdmin("/admin/settings");
  const parsed = parseContactForm(formFields(formData));
  if (!parsed.ok) return { errors: parsed.errors, saved: false };

  try {
    await saveStoreContact(parsed.value);
  } catch {
    return { errors: { form: "Something went wrong, please try again." }, saved: false };
  }

  for (const path of STORE_PAGE_PATHS) revalidatePath(path);
  return { errors: {}, saved: true };
}
