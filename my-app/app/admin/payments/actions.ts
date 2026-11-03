"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { parseAdvanceSettings } from "@/lib/advance";
import {
  addQrCode,
  bankDetailsComplete,
  createQrUpload,
  objectExists,
  removeQrCode,
  savePaymentSettings,
} from "@/lib/payments-data";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

export type PaymentSettingsState = { errors: Record<string, string>; saved: boolean };
export type QrState = { error: string | null };

const SOMETHING_WRONG = "Something went wrong, please try again.";
const QR_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const QR_MAX_BYTES = 5 * 1024 * 1024;
const QR_PATH = /^qr-\d+-[a-z0-9]{6,12}\.(jpg|png|webp)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formFields(formData: FormData): Record<string, string | undefined> {
  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

// Checkout and every order page read these settings.
function revalidatePayments() {
  revalidatePath("/admin/payments");
  revalidatePath("/checkout");
  revalidatePath("/orders/[number]", "page");
}

export async function savePaymentSettingsAction(
  _prev: PaymentSettingsState,
  formData: FormData,
): Promise<PaymentSettingsState> {
  await requireAdmin("/admin/payments");
  const parsed = parseAdvanceSettings(formFields(formData));
  if (!parsed.ok) return { errors: parsed.errors as Record<string, string>, saved: false };
  // An advance with nowhere to send it would strand customers at checkout.
  if (parsed.value.mode !== "off" && !bankDetailsComplete(parsed.value)) {
    return {
      errors: { bankName: "Fill in the bank, account name and account number before switching the advance on." },
      saved: false,
    };
  }
  try {
    await savePaymentSettings(parsed.value);
  } catch {
    return { errors: { form: SOMETHING_WRONG }, saved: false };
  }
  revalidatePayments();
  return { errors: {}, saved: true };
}

/** A one-time signed URL the browser uploads a QR image to. */
export async function requestQrUpload(
  contentType: string,
  size: number,
): Promise<{ path: string; token: string } | { error: string }> {
  await requireAdmin("/admin/payments");
  const ext = Object.hasOwn(QR_TYPES, contentType) ? QR_TYPES[contentType] : undefined;
  if (!ext || !Number.isFinite(size) || size <= 0 || size > QR_MAX_BYTES) {
    return { error: "Use a JPG, PNG or WebP image up to 5 MB." };
  }
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  try {
    return await createQrUpload(`qr-${Date.now()}-${rand}.${ext}`);
  } catch {
    return { error: SOMETHING_WRONG };
  }
}

/** Adds an uploaded QR image to the list (at most four). */
export async function addQrAction(path: string, label: string): Promise<QrState> {
  await requireAdmin("/admin/payments");
  if (typeof path !== "string" || !QR_PATH.test(path)) return { error: SOMETHING_WRONG };
  const cleanLabel = typeof label === "string" ? label.trim() : "";
  if (cleanLabel.length > 40 || /[\u0000-\u001F\u007F]/.test(cleanLabel)) {
    return { error: "The label can be up to 40 characters." };
  }
  try {
    if (!(await objectExists("payment-qr", path))) return { error: SOMETHING_WRONG };
    if ((await addQrCode(path, cleanLabel)) === "full") {
      return { error: "You can keep up to 4 QR images. Remove one first." };
    }
  } catch {
    return { error: SOMETHING_WRONG };
  }
  revalidatePayments();
  return { error: null };
}

export async function removeQrAction(id: string): Promise<QrState> {
  await requireAdmin("/admin/payments");
  if (typeof id !== "string" || !UUID.test(id)) return { error: SOMETHING_WRONG };
  try {
    await removeQrCode(id);
  } catch {
    return { error: SOMETHING_WRONG };
  }
  revalidatePayments();
  return { error: null };
}
