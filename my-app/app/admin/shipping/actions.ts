"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { validateCourier, validateZones, type ZoneInput } from "@/lib/shipping";
import { deleteCourier, saveCourier, saveZones } from "@/lib/shipping-data";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

export type ZonesState = { errors: string[]; saved: boolean };
export type CourierState = { errors: Record<string, string>; saved: boolean };
export type CourierRowState = { error: string | null };

const SOMETHING_WRONG = "Something went wrong, please try again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateShipping() {
  revalidatePath("/admin/shipping");
  revalidatePath("/checkout");
}

function readZones(raw: FormDataEntryValue | null): ZoneInput[] | null {
  if (typeof raw !== "string" || raw.length > 40000) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const zones: ZoneInput[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) return null;
      const { name, fee, districts, bands, extraPerKg } = item as Record<string, unknown>;
      if (typeof name !== "string" || typeof fee !== "string") return null;
      if (!Array.isArray(districts) || districts.some((d) => typeof d !== "string")) return null;
      if (extraPerKg !== undefined && typeof extraPerKg !== "string") return null;
      let readBands: { upToGrams: string; fee: string }[] = [];
      if (bands !== undefined) {
        if (!Array.isArray(bands)) return null;
        for (const band of bands) {
          if (typeof band !== "object" || band === null) return null;
          const { upToGrams, fee: bandFee } = band as Record<string, unknown>;
          if (typeof upToGrams !== "string" || typeof bandFee !== "string") return null;
          readBands.push({ upToGrams, fee: bandFee });
        }
      } else {
        readBands = [];
      }
      zones.push({ name, fee, districts: districts as string[], bands: readBands, extraPerKg });
    }
    return zones;
  } catch {
    return null;
  }
}

export async function saveZonesAction(_prev: ZonesState, formData: FormData): Promise<ZonesState> {
  await requireAdmin("/admin/shipping");
  const zones = readZones(formData.get("zones"));
  if (!zones) return { errors: [SOMETHING_WRONG], saved: false };
  const parsed = validateZones(zones);
  if (!parsed.ok) return { errors: parsed.errors, saved: false };
  try {
    await saveZones(parsed.value);
  } catch {
    return { errors: ["Could not save the zones, nothing was changed."], saved: false };
  }
  revalidateShipping();
  return { errors: [], saved: true };
}

export async function saveCourierAction(_prev: CourierState, formData: FormData): Promise<CourierState> {
  await requireAdmin("/admin/shipping");
  const idField = formData.get("id");
  const id = typeof idField === "string" && idField !== "" ? idField : undefined;
  if (id !== undefined && !UUID.test(id)) return { errors: { form: SOMETHING_WRONG }, saved: false };
  const name = formData.get("name");
  const template = formData.get("template");
  const parsed = validateCourier({
    name: typeof name === "string" ? name : "",
    template: typeof template === "string" ? template : "",
  });
  if (!parsed.ok) return { errors: parsed.errors, saved: false };
  try {
    await saveCourier({
      id,
      name: parsed.value.name,
      template: parsed.value.template,
      active: id ? formData.get("active") === "on" : true,
    });
  } catch {
    return { errors: { form: SOMETHING_WRONG }, saved: false };
  }
  revalidateShipping();
  revalidatePath("/admin/orders/[number]", "page");
  return { errors: {}, saved: true };
}

export async function deleteCourierAction(id: string): Promise<CourierRowState> {
  await requireAdmin("/admin/shipping");
  if (typeof id !== "string" || !UUID.test(id)) return { error: SOMETHING_WRONG };
  try {
    await deleteCourier(id);
  } catch {
    return { error: SOMETHING_WRONG };
  }
  revalidateShipping();
  revalidatePath("/admin/orders/[number]", "page");
  return { error: null };
}
