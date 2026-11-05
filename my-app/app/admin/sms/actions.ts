"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { parseSmsSettings } from "@/lib/otp";
import { saveSmsSettings } from "@/lib/sms-data";
import { smsTokenSet } from "@/lib/sms";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

export type SmsSettingsState = { errors: Record<string, string>; saved: boolean };

const SOMETHING_WRONG = "Something went wrong, please try again.";

function formFields(formData: FormData): Record<string, string | undefined> {
  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

export async function saveSmsSettingsAction(
  _prev: SmsSettingsState,
  formData: FormData,
): Promise<SmsSettingsState> {
  await requireAdmin("/admin/sms");
  const parsed = parseSmsSettings(formFields(formData));
  if (!parsed.ok) return { errors: parsed.errors, saved: false };
  // Switching on without a token would make every code request fail.
  if (parsed.value.enabled && !smsTokenSet()) {
    return { errors: { enabled: "Set TEXTLK_API_TOKEN on the server first" }, saved: false };
  }
  try {
    await saveSmsSettings(parsed.value);
  } catch {
    return { errors: { form: SOMETHING_WRONG }, saved: false };
  }
  revalidatePath("/admin/sms");
  revalidatePath("/signin");
  return { errors: {}, saved: true };
}
