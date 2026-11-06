"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { parseNotificationSettings } from "@/lib/notifications";
import { resendNotification, saveNotificationSettings } from "@/lib/notifications-data";
import { saveOwnerAlertSettings } from "@/lib/owner-alerts-data";
import { parseOwnerAlertSettings } from "@/lib/owner-alerts";
import { smsTokenSet } from "@/lib/sms";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

export type NotificationSettingsState = { errors: Record<string, string>; saved: boolean };

const SOMETHING_WRONG = "Something went wrong, please try again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formFields(formData: FormData): Record<string, string | undefined> {
  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

export async function saveNotificationSettingsAction(
  _prev: NotificationSettingsState,
  formData: FormData,
): Promise<NotificationSettingsState> {
  await requireAdmin("/admin/notifications");
  const settings = parseNotificationSettings(formFields(formData));
  if (settings.enabled && !smsTokenSet()) {
    return { errors: { enabled: "Set TEXTLK_API_TOKEN on the server first" }, saved: false };
  }
  try {
    await saveNotificationSettings(settings);
  } catch {
    return { errors: { form: SOMETHING_WRONG }, saved: false };
  }
  revalidatePath("/admin/notifications");
  return { errors: {}, saved: true };
}

export type OwnerAlertSettingsState = { errors: Record<string, string>; saved: boolean };

export async function saveOwnerAlertSettingsAction(
  _prev: OwnerAlertSettingsState,
  formData: FormData,
): Promise<OwnerAlertSettingsState> {
  await requireAdmin("/admin/notifications");
  const parsed = parseOwnerAlertSettings(formFields(formData));
  if (!parsed.ok) return { errors: parsed.errors, saved: false };
  if (parsed.value.enabled && !smsTokenSet()) {
    return { errors: { enabled: "Set TEXTLK_API_TOKEN on the server first" }, saved: false };
  }
  try {
    await saveOwnerAlertSettings(parsed.value);
  } catch {
    return { errors: { form: SOMETHING_WRONG }, saved: false };
  }
  revalidatePath("/admin/notifications");
  return { errors: {}, saved: true };
}

export async function resendNotificationAction(id: string): Promise<{ error: string | null }> {
  await requireAdmin("/admin/notifications");
  if (typeof id !== "string" || !UUID.test(id)) {
    return { error: "That message can't be resent (refresh the page)." };
  }
  const result = await resendNotification(id);
  revalidatePath("/admin/notifications");
  if (result === "ok") return { error: null };
  if (result === "failed_again") {
    return { error: "Couldn't send it. Check the token, sender ID and switch." };
  }
  return { error: "That message can't be resent (refresh the page)." };
}
