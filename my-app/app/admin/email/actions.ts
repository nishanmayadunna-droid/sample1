"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { parseEmailSettings } from "@/lib/email";
import { emailConfigured, saveEmailSettings } from "@/lib/email-data";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

export type EmailSettingsState = { errors: Record<string, string>; saved: boolean };

export async function saveEmailSettingsAction(
  _prev: EmailSettingsState,
  formData: FormData,
): Promise<EmailSettingsState> {
  await requireAdmin("/admin/email");
  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  const settings = parseEmailSettings(fields);
  if (settings.enabled && !emailConfigured()) {
    return {
      errors: { enabled: "Set RESEND_API_KEY and EMAIL_FROM on the server first." },
      saved: false,
    };
  }
  try {
    await saveEmailSettings(settings);
  } catch {
    return { errors: { form: "Something went wrong, please try again." }, saved: false };
  }
  revalidatePath("/admin/email");
  return { errors: {}, saved: true };
}
