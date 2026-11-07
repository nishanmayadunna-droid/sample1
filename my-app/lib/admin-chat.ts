// Admin-side reads and writes for the Maya chat (secret-key client, includes hidden topics).
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseChatSettings, parseTopicRow, type ChatTopic, type ParsedChatSettings } from "./chat";
import { DEFAULT_TOPICS } from "./chat-defaults";
import type { ChatSettingsRow } from "./chat-form";

const BUCKET = "chat-assets";

function fail(error: unknown): never {
  console.error("chat admin query failed", error);
  throw new Error("chat admin query failed");
}

export async function getChatSettingsForAdmin(): Promise<ParsedChatSettings> {
  const { data, error } = await supabaseAdmin.from("chat_settings").select("*").maybeSingle();
  if (error) fail(error);
  return parseChatSettings(data);
}

export async function saveChatSettings(value: ChatSettingsRow): Promise<void> {
  const { error } = await supabaseAdmin
    .from("chat_settings")
    .upsert({ id: true, ...value, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) fail(error);
}

const toRow = (t: ChatTopic) => ({
  id: t.id,
  title_si: t.title.si,
  title_en: t.title.en,
  keywords: t.keywords,
  answer_si: t.answer.si,
  answer_en: t.answer.en,
  links: t.links,
  follow_ups: t.followUps,
  requires: t.requires ?? null,
  sort_order: t.sortOrder,
  visible: t.visible,
  updated_at: new Date().toISOString(),
});

/** The stored topics, or the built-in defaults (flagged) while the table is empty. */
export async function listTopicsForAdmin(): Promise<{ topics: ChatTopic[]; isDefault: boolean }> {
  const { data, error } = await supabaseAdmin.from("chat_topics").select("*").order("sort_order");
  if (error) fail(error);
  const topics = (data ?? []).map(parseTopicRow).filter((t): t is ChatTopic => t !== null);
  return topics.length > 0 ? { topics, isDefault: false } : { topics: DEFAULT_TOPICS, isDefault: true };
}

/** First edit: copy the defaults into the table so they can be changed one by one. */
export async function seedTopicsIfEmpty(): Promise<void> {
  const { count, error } = await supabaseAdmin.from("chat_topics").select("id", { count: "exact", head: true });
  if (error || count === null) fail(error);
  if (count > 0) return;
  const { error: insertError } = await supabaseAdmin.from("chat_topics").insert(DEFAULT_TOPICS.map(toRow));
  if (insertError) fail(insertError);
}

export async function saveTopic(topic: ChatTopic): Promise<void> {
  const { error } = await supabaseAdmin.from("chat_topics").upsert(toRow(topic), { onConflict: "id" });
  if (error) fail(error);
}

export async function deleteTopic(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("chat_topics").delete().eq("id", id);
  if (error) fail(error);
}

/** Swaps the position of a topic with its neighbour. */
export async function moveTopic(id: string, direction: "up" | "down"): Promise<void> {
  const { topics } = await listTopicsForAdmin();
  const index = topics.findIndex((t) => t.id === id);
  const other = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || other < 0 || other >= topics.length) return;
  const reordered = [...topics];
  [reordered[index], reordered[other]] = [reordered[other], reordered[index]];
  const rows = reordered.map((t, i) => ({ ...toRow(t), sort_order: (i + 1) * 10 }));
  const { error } = await supabaseAdmin.from("chat_topics").upsert(rows, { onConflict: "id" });
  if (error) fail(error);
}

/** Removes every stored topic so the built-in defaults apply again. */
export async function resetTopics(): Promise<void> {
  const { error } = await supabaseAdmin.from("chat_topics").delete().neq("id", "");
  if (error) fail(error);
}

export async function createMascotUpload(path: string): Promise<{ path: string; token: string }> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) fail(error);
  return { path: data.path, token: data.token };
}

export async function mascotExists(path: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list("", { search: path, limit: 100 });
  if (error) fail(error);
  return data.some((file) => file.name === path);
}

/** Sets (or clears) the mascot and returns the previous path so the caller can clean it up. */
export async function setMascotPath(path: string | null): Promise<string | null> {
  const before = await getChatSettingsForAdmin();
  const { error } = await supabaseAdmin
    .from("chat_settings")
    .upsert({ id: true, mascot_path: path, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) fail(error);
  return before.mascotPath;
}

export async function deleteMascotFile(path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (error) console.error("mascot cleanup failed", error.message);
}
