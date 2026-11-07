"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { isValidMascot, isValidMascotPath } from "@/lib/chat";
import { aiAvailable } from "@/lib/chat-data";
import { parseChatSettingsForm, parseTopicForm } from "@/lib/chat-form";
import {
  createMascotUpload,
  deleteMascotFile,
  deleteTopic,
  mascotExists,
  moveTopic,
  resetTopics,
  saveChatSettings,
  saveTopic,
  seedTopicsIfEmpty,
  setMascotPath,
} from "@/lib/admin-chat";

// Every action re-checks admin access first: Server Actions are endpoints of their own.

export type ChatFormState = { errors: string[]; saved: boolean };

function refresh() {
  // The widget lives in the root layout, so a save must reach every page.
  revalidatePath("/", "layout");
  revalidatePath("/admin/chat");
}

export async function saveChatSettingsAction(_prev: ChatFormState, formData: FormData): Promise<ChatFormState> {
  await requireAdmin("/admin/chat");
  const parsed = parseChatSettingsForm(formData, { aiKeySet: aiAvailable() });
  if (!parsed.ok) return { errors: parsed.errors, saved: false };
  try {
    await saveChatSettings(parsed.value);
  } catch {
    return { errors: ["server"], saved: false };
  }
  refresh();
  return { errors: [], saved: true };
}

export async function saveTopicAction(_prev: ChatFormState, formData: FormData): Promise<ChatFormState> {
  await requireAdmin("/admin/chat");
  const parsed = parseTopicForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, saved: false };
  try {
    await seedTopicsIfEmpty();
    await saveTopic(parsed.value);
  } catch {
    return { errors: ["server"], saved: false };
  }
  refresh();
  return { errors: [], saved: true };
}

export async function deleteTopicAction(id: string): Promise<"ok" | "error"> {
  await requireAdmin("/admin/chat");
  if (typeof id !== "string" || !/^[a-z0-9-]{1,40}$/.test(id)) return "error";
  try {
    await seedTopicsIfEmpty();
    await deleteTopic(id);
  } catch {
    return "error";
  }
  refresh();
  return "ok";
}

export async function moveTopicAction(id: string, direction: "up" | "down"): Promise<"ok" | "error"> {
  await requireAdmin("/admin/chat");
  if (typeof id !== "string" || (direction !== "up" && direction !== "down")) return "error";
  try {
    await seedTopicsIfEmpty();
    await moveTopic(id, direction);
  } catch {
    return "error";
  }
  refresh();
  return "ok";
}

export async function resetTopicsAction(): Promise<"ok" | "error"> {
  await requireAdmin("/admin/chat");
  try {
    await resetTopics();
  } catch {
    return "error";
  }
  refresh();
  return "ok";
}

/** A signed upload URL for a new mascot picture; the type and size are checked here, not trusted from the browser. */
export async function requestMascotUpload(
  contentType: string,
  size: number,
): Promise<{ path: string; token: string } | { error: "bad_file" | "error" }> {
  await requireAdmin("/admin/chat");
  if (typeof contentType !== "string" || typeof size !== "number" || !isValidMascot(contentType, size)) {
    return { error: "bad_file" };
  }
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  try {
    return await createMascotUpload(`${Date.now()}.${ext}`);
  } catch {
    return { error: "error" };
  }
}

/** Saves an uploaded mascot (or clears it to go back to the built-in panda). */
export async function saveMascotAction(path: string | null): Promise<"ok" | "bad_file" | "error"> {
  await requireAdmin("/admin/chat");
  if (path !== null && (typeof path !== "string" || !isValidMascotPath(path))) return "bad_file";
  try {
    if (path !== null && !(await mascotExists(path))) return "bad_file";
    const previous = await setMascotPath(path);
    if (previous && previous !== path) await deleteMascotFile(previous);
  } catch {
    return "error";
  }
  refresh();
  return "ok";
}
