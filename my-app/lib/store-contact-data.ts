// Public read of the shop's contact details. Cookie-less client, so pages stay static (ISR).
import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_STORE_CONTACT, type StoreContact } from "./store-contact";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
);

type ContactRow = {
  business_name: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  hours: string;
  return_days: number;
};

/** The shop's contact details; the defaults when they can't be read. */
export const getStoreContact = cache(async (): Promise<StoreContact> => {
  try {
    const { data, error } = await supabase
      .from("store_contact")
      .select("business_name, phone, whatsapp, email, address, hours, return_days")
      .maybeSingle<ContactRow>();
    if (error || !data) {
      if (error) console.error("store contact unreadable", error.code ?? "unknown");
      return { ...DEFAULT_STORE_CONTACT };
    }
    return {
      businessName: data.business_name ?? "",
      phone: data.phone ?? "",
      whatsapp: data.whatsapp ?? "",
      email: data.email ?? "",
      address: data.address ?? "",
      hours: data.hours ?? "",
      returnDays: data.return_days ?? DEFAULT_STORE_CONTACT.returnDays,
    };
  } catch {
    console.error("store contact unreadable");
    return { ...DEFAULT_STORE_CONTACT };
  }
});
