// Server-side reads for delivery: shipping zones (public, cookie-less so
// checkout stays simple) and couriers (admin client).
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Zone, ZoneValue } from "@/lib/shipping";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
);

type ZoneRow = {
  id: string;
  name: string;
  fee: number;
  districts: string[];
  sort_order: number;
  bands: { upToGrams: number; fee: number }[] | null;
  extra_per_kg: number | null;
};

/** Shipping zones in display order; none (so the default fee applies) on any error. */
export async function getZones(): Promise<Zone[]> {
  try {
    const { data, error } = await supabase
      .from("shipping_zones")
      .select("id, name, fee, districts, sort_order, bands, extra_per_kg")
      .order("sort_order")
      .returns<ZoneRow[]>();
    if (error || !data) {
      console.error("shipping zones query failed", error?.code);
      return [];
    }
    return data.map((row) => ({
      id: row.id,
      name: row.name,
      fee: row.fee,
      districts: row.districts ?? [],
      sortOrder: row.sort_order,
      bands: Array.isArray(row.bands) ? row.bands : [],
      extraPerKg: row.extra_per_kg ?? 0,
    }));
  } catch (error) {
    console.error("shipping zones query failed", error instanceof Error ? error.name : "unknown");
    return [];
  }
}

export type Courier = {
  id: string;
  name: string;
  trackingUrlTemplate: string | null;
  active: boolean;
  sortOrder: number;
};

type CourierRow = {
  id: string;
  name: string;
  tracking_url_template: string | null;
  active: boolean;
  sort_order: number;
};

/** Every courier (active or not), in display order. For admin pages. */
export async function listCouriers(): Promise<Courier[]> {
  const { data, error } = await supabaseAdmin
    .from("couriers")
    .select("id, name, tracking_url_template, active, sort_order")
    .order("sort_order")
    .order("name")
    .returns<CourierRow[]>();
  if (error) {
    console.error("couriers query failed", error.code);
    throw new Error("couriers query failed");
  }
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    trackingUrlTemplate: row.tracking_url_template,
    active: row.active,
    sortOrder: row.sort_order,
  }));
}

/** Replaces every zone in one database transaction (all or nothing). Fees are cents. */
export async function saveZones(
  zones: ZoneValue[],
): Promise<void> {
  const { error } = await supabaseAdmin.rpc("save_shipping_zones", { p_zones: zones });
  if (error) {
    console.error("shipping zones save failed", error.code);
    throw new Error("shipping zones save failed");
  }
}

/** Creates a courier (no id) or updates one. `active` is left alone when omitted. */
export async function saveCourier(input: {
  id?: string;
  name: string;
  template: string | null;
  active?: boolean;
}): Promise<void> {
  const fields = {
    name: input.name,
    tracking_url_template: input.template,
    ...(input.active === undefined ? {} : { active: input.active }),
  };
  if (input.id) {
    const { error } = await supabaseAdmin.from("couriers").update(fields).eq("id", input.id);
    if (error) {
      console.error("courier update failed", error.code);
      throw new Error("courier update failed");
    }
    return;
  }
  const { data: last } = await supabaseAdmin
    .from("couriers")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .returns<{ sort_order: number }[]>();
  const { error } = await supabaseAdmin
    .from("couriers")
    .insert({ ...fields, sort_order: (last?.[0]?.sort_order ?? -1) + 1 });
  if (error) {
    console.error("courier insert failed", error.code);
    throw new Error("courier insert failed");
  }
}

export async function deleteCourier(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("couriers").delete().eq("id", id);
  if (error) {
    console.error("courier delete failed", error.code);
    throw new Error("courier delete failed");
  }
}
