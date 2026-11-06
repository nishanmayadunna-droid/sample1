"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { parseBonusForm, parseExpiryDays, parseTierForm } from "@/lib/points-v2";
import {
  addBonus,
  addTier,
  deleteBonus,
  deleteTier,
  expirePointsNow,
  listTiers,
  saveExpiryDays,
  setBonusActive,
} from "@/lib/points-v2-data";
import { colomboToUtcIso } from "@/lib/promotion-form";

// Part 18: expiry, bonus events and tiers. Every action re-checks admin access
// first: Server Actions are endpoints of their own.

export type SimpleState = { errors: Record<string, string>; saved: boolean };

const SOMETHING_WRONG = "Something went wrong, please try again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formFields(formData: FormData): Record<string, string | undefined> {
  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

function refreshPoints() {
  revalidatePath("/admin/points");
  revalidatePath("/account");
  revalidatePath("/admin/customers");
}

export async function saveExpiryAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  await requireAdmin("/admin/points");
  const days = parseExpiryDays(formFields(formData).days);
  if (days === null) {
    return { errors: { days: "Enter a whole number of days from 0 to 3650 (0 = never)." }, saved: false };
  }
  try {
    await saveExpiryDays(days);
  } catch {
    return { errors: { form: SOMETHING_WRONG }, saved: false };
  }
  refreshPoints();
  return { errors: {}, saved: true };
}

/** Expires old unspent points now, the same as the daily schedule. */
export async function expirePointsAction(): Promise<{ error: string | null; customers: number }> {
  await requireAdmin("/admin/points");
  try {
    const customers = await expirePointsNow();
    refreshPoints();
    return { error: null, customers };
  } catch {
    return { error: SOMETHING_WRONG, customers: 0 };
  }
}

export async function addBonusAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  await requireAdmin("/admin/points");
  const fields = formFields(formData);
  // The form uses Colombo wall-clock times, like promotions.
  const parsed = parseBonusForm({
    ...fields,
    startsAt: colomboToUtcIso(fields.startsAt ?? "") ?? "",
    endsAt: colomboToUtcIso(fields.endsAt ?? "") ?? "",
  });
  if (!parsed.ok) return { errors: parsed.errors, saved: false };
  try {
    await addBonus(parsed.value);
  } catch {
    return { errors: { form: SOMETHING_WRONG }, saved: false };
  }
  refreshPoints();
  return { errors: {}, saved: true };
}

export async function setBonusActiveAction(id: string, active: boolean): Promise<{ error: string | null }> {
  await requireAdmin("/admin/points");
  if (typeof id !== "string" || !UUID.test(id) || typeof active !== "boolean") return { error: SOMETHING_WRONG };
  try {
    await setBonusActive(id, active);
  } catch {
    return { error: SOMETHING_WRONG };
  }
  refreshPoints();
  return { error: null };
}

export async function deleteBonusAction(id: string): Promise<{ error: string | null }> {
  await requireAdmin("/admin/points");
  if (typeof id !== "string" || !UUID.test(id)) return { error: SOMETHING_WRONG };
  try {
    await deleteBonus(id);
  } catch {
    return { error: SOMETHING_WRONG };
  }
  refreshPoints();
  return { error: null };
}

export async function addTierAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  await requireAdmin("/admin/points");
  try {
    const parsed = parseTierForm(formFields(formData), await listTiers());
    if (!parsed.ok) return { errors: parsed.errors, saved: false };
    if ((await addTier(parsed.value)) === "duplicate") {
      return { errors: { minSpend: "Another tier already starts at that amount." }, saved: false };
    }
  } catch {
    return { errors: { form: SOMETHING_WRONG }, saved: false };
  }
  refreshPoints();
  return { errors: {}, saved: true };
}

export async function deleteTierAction(id: string): Promise<{ error: string | null }> {
  await requireAdmin("/admin/points");
  if (typeof id !== "string" || !UUID.test(id)) return { error: SOMETHING_WRONG };
  try {
    await deleteTier(id);
  } catch {
    return { error: SOMETHING_WRONG };
  }
  refreshPoints();
  return { error: null };
}
