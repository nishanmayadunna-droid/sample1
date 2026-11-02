// Server-side storefront management for /admin/settings and /admin/promises.
// Uses the secret-key client; callers must check requireAdmin() first.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { LanguageSettingsInput } from "@/lib/storefront-form";

function fail(error: unknown): never {
  console.error("admin storefront query failed", error);
  throw new Error("admin storefront query failed");
}

export async function saveLanguageSettings(value: LanguageSettingsInput): Promise<void> {
  const { error } = await supabaseAdmin
    .from("store_settings")
    .update({ ...value, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) fail(error);
}
