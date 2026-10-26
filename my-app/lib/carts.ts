// Server-side access to public.carts (one row per signed-in user).
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sanitizeCartLines, type CartLine } from "@/lib/cart-rules";

function fail(error: unknown): never {
  console.error("carts query failed", error);
  throw new Error("carts query failed");
}

export async function getCart(userId: string): Promise<CartLine[]> {
  const { data, error } = await supabaseAdmin
    .from("carts")
    .select("lines")
    .eq("user_id", userId)
    .maybeSingle<{ lines: unknown }>();
  if (error) fail(error);
  return sanitizeCartLines(data?.lines);
}

export async function saveCart(userId: string, lines: CartLine[]): Promise<void> {
  const { error } = await supabaseAdmin
    .from("carts")
    .upsert(
      { user_id: userId, lines, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) fail(error);
}
