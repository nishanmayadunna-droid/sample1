// Admin write of the shop's contact details (secret-key client).
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { StoreContact } from "@/lib/store-contact";

export async function saveStoreContact(value: StoreContact): Promise<void> {
  const { error } = await supabaseAdmin.from("store_contact").upsert(
    {
      id: true,
      business_name: value.businessName,
      phone: value.phone,
      whatsapp: value.whatsapp,
      email: value.email,
      address: value.address,
      hours: value.hours,
      return_days: value.returnDays,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) {
    console.error("store contact save failed", error.code ?? "unknown");
    throw new Error("Could not save the contact details.");
  }
}
