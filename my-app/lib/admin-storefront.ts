// Server-side storefront management for /admin/settings and /admin/promises.
// Uses the secret-key client; callers must check requireAdmin() first.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PROMISE_COLUMNS, toStorePromise, type PromiseRow } from "@/lib/storefront";
import type {
  LanguageSettingsInput,
  PromiseInput,
  StorePromise,
} from "@/lib/storefront-form";

// Postgres invalid_text_representation: e.g. a malformed uuid.
const INVALID_TEXT = "22P02";

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

export async function listPromisesForAdmin(): Promise<StorePromise[]> {
  const { data, error } = await supabaseAdmin
    .from("store_promises")
    .select(PROMISE_COLUMNS)
    .order("sort_order")
    .order("created_at")
    .returns<PromiseRow[]>();
  if (error) fail(error);
  return data.map(toStorePromise);
}

export async function getPromiseForAdmin(id: string): Promise<StorePromise | null> {
  const { data, error } = await supabaseAdmin
    .from("store_promises")
    .select(PROMISE_COLUMNS)
    .eq("id", id)
    .maybeSingle<PromiseRow>();
  // An id that isn't a uuid is simply "not found".
  if (error?.code === INVALID_TEXT) return null;
  if (error) fail(error);
  return data ? toStorePromise(data) : null;
}

/** Visible promises, not counting `excludeId` (the one being edited). */
export async function countVisiblePromises(excludeId?: string): Promise<number> {
  let query = supabaseAdmin
    .from("store_promises")
    .select("id", { count: "exact", head: true })
    .eq("visible", true);
  if (excludeId) query = query.neq("id", excludeId);
  const { count, error } = await query;
  if (error) fail(error);
  return count ?? 0;
}

/** Adds a promise at the end of the list. */
export async function insertPromise(value: PromiseInput): Promise<void> {
  const { data: last, error: readError } = await supabaseAdmin
    .from("store_promises")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();
  if (readError) fail(readError);
  const { error } = await supabaseAdmin
    .from("store_promises")
    .insert({ ...value, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) fail(error);
}

export async function updatePromise(id: string, value: PromiseInput): Promise<void> {
  const { error } = await supabaseAdmin.from("store_promises").update(value).eq("id", id);
  if (error) fail(error);
}

export async function setPromiseVisible(id: string, visible: boolean): Promise<void> {
  const { error } = await supabaseAdmin.from("store_promises").update({ visible }).eq("id", id);
  if (error) fail(error);
}

/** Swaps a promise with its neighbour in the list (positions are renumbered 1..n). */
export async function movePromise(id: string, direction: "up" | "down"): Promise<void> {
  const list = await listPromisesForAdmin();
  const index = list.findIndex((p) => p.id === id);
  const other = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || other < 0 || other >= list.length) return;
  [list[index], list[other]] = [list[other], list[index]];
  for (const [i, promise] of list.entries()) {
    if (promise.sortOrder === i + 1) continue;
    const { error } = await supabaseAdmin
      .from("store_promises")
      .update({ sort_order: i + 1 })
      .eq("id", promise.id);
    if (error) fail(error);
  }
}

export async function deletePromise(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("store_promises").delete().eq("id", id);
  if (error) fail(error);
}
