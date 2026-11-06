"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { parsePushSettings } from "@/lib/push";
import { firebaseWebConfigured, pushConfigured, registerToken, savePushSettings, unregisterToken } from "@/lib/push-data";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages. The user
// id of a device always comes from the admin's session, never from the browser.

export type PushSettingsState = { errors: Record<string, string>; saved: boolean };
export type PushActionResult = "ok" | "invalid" | "too_many" | "error";

export async function savePushSettingsAction(_prev: PushSettingsState, formData: FormData): Promise<PushSettingsState> {
  await requireAdmin("/admin/push");
  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  const settings = parsePushSettings(fields);
  if (settings.enabled && !pushConfigured()) {
    return {
      errors: { enabled: "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY on the server first." },
      saved: false,
    };
  }
  if (settings.enabled && !firebaseWebConfigured()) {
    return {
      errors: { enabled: "Set the NEXT_PUBLIC_FIREBASE_* web config and NEXT_PUBLIC_FIREBASE_VAPID_KEY first, then rebuild." },
      saved: false,
    };
  }
  try {
    await savePushSettings(settings);
  } catch {
    return { errors: { form: "Something went wrong, please try again." }, saved: false };
  }
  revalidatePath("/admin/push");
  revalidatePath("/admin/notifications");
  revalidatePath("/account");
  return { errors: {}, saved: true };
}

/** Saves this browser's FCM token for the signed-in admin (their owner alerts). */
export async function registerAdminPushAction(token: string, platform: string): Promise<PushActionResult> {
  const admin = await requireAdmin("/admin/push");
  if (typeof token !== "string" || typeof platform !== "string" || platform !== "web") return "invalid";
  try {
    return await registerToken(admin.id, "web", token);
  } catch {
    return "error";
  }
}

export async function unregisterAdminPushAction(token: string): Promise<PushActionResult> {
  const admin = await requireAdmin("/admin/push");
  if (typeof token !== "string") return "invalid";
  try {
    const result = await unregisterToken(admin.id, token);
    return result === "ok" || result === "not_found" ? "ok" : result === "invalid" ? "invalid" : "error";
  } catch {
    return "error";
  }
}
