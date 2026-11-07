// Public read of the shop's brand. Cookie-less client, so pages stay static (ISR).
// It never throws: any error, or a missing table, gives today's Northbound defaults, so the
// storefront keeps working (and the code can be deployed before the migration).
import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_BRAND, parseBrandRow, senderName, type Brand } from "./brand";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
);

export const getBrand = cache(async (): Promise<Brand> => {
  try {
    const { data, error } = await supabase.from("store_brand").select("*").maybeSingle();
    if (error || !data) {
      if (error) console.error("store brand unreadable", error.code ?? "unknown");
      return DEFAULT_BRAND;
    }
    return parseBrandRow(data);
  } catch (error) {
    console.error("store brand failed", error instanceof Error ? error.name : "unknown");
    return DEFAULT_BRAND;
  }
});

/** The full shop name, for text outside the page chrome. */
export async function getBrandName(): Promise<string> {
  return (await getBrand()).name;
}

/** The name used in SMS, email and push; `ascii` is for owner alerts (printable ASCII only). */
export async function getSenderName(opts: { ascii?: boolean } = {}): Promise<string> {
  return senderName(await getBrand(), { ascii: opts.ascii === true });
}
