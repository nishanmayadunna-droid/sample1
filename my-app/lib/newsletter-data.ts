// Newsletter subscribers (private table, secret-key client). Never log emails or tokens.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type Subscriber = {
  id: string;
  email: string;
  source: string;
  createdAt: string;
  unsubscribedAt: string | null;
};

type Row = {
  id: string;
  email: string;
  source: string;
  created_at: string;
  unsubscribed_at: string | null;
};

const COLUMNS = "id, email, source, created_at, unsubscribed_at";
const EXPORT_CAP = 10000;

function toSubscriber(r: Row): Subscriber {
  return {
    id: r.id,
    email: r.email,
    source: r.source,
    createdAt: r.created_at,
    unsubscribedAt: r.unsubscribed_at,
  };
}

export async function subscribeEmail(
  email: string,
  source: string,
): Promise<"subscribed" | "busy" | "error"> {
  try {
    const { data, error } = await supabaseAdmin.rpc("subscribe_newsletter", {
      p_email: email,
      p_source: source,
    });
    if (error) {
      console.error("newsletter subscribe failed", error.code ?? "unknown");
      return "error";
    }
    if (data === "subscribed" || data === "busy") return data;
    return "error";
  } catch {
    console.error("newsletter subscribe failed");
    return "error";
  }
}

export async function unsubscribeByToken(token: string): Promise<"ok" | "not_found" | "error"> {
  try {
    const { data, error } = await supabaseAdmin.rpc("unsubscribe_newsletter", { p_token: token });
    if (error) {
      console.error("newsletter unsubscribe failed", error.code ?? "unknown");
      return "error";
    }
    if (data === "ok" || data === "not_found") return data;
    return "error";
  } catch {
    console.error("newsletter unsubscribe failed");
    return "error";
  }
}

export async function listSubscribers(
  limit = 200,
): Promise<{ rows: Subscriber[]; active: number; unsubscribed: number }> {
  const [rowsRes, activeRes, unsubRes] = await Promise.all([
    supabaseAdmin
      .from("newsletter_subscribers")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<Row[]>(),
    supabaseAdmin
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .is("unsubscribed_at", null),
    supabaseAdmin
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .not("unsubscribed_at", "is", null),
  ]);
  if (rowsRes.error || activeRes.error || unsubRes.error) {
    const code = rowsRes.error?.code ?? activeRes.error?.code ?? unsubRes.error?.code ?? "unknown";
    console.error("newsletter list failed", code);
    throw new Error("Could not load subscribers.");
  }
  return {
    rows: (rowsRes.data ?? []).map(toSubscriber),
    active: activeRes.count ?? 0,
    unsubscribed: unsubRes.count ?? 0,
  };
}

export async function deleteSubscriber(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("newsletter_subscribers").delete().eq("id", id);
  if (error) {
    console.error("newsletter delete failed", error.code ?? "unknown");
    throw new Error("Could not delete the subscriber.");
  }
}

export async function exportSubscribers(): Promise<Subscriber[]> {
  const { data, error } = await supabaseAdmin
    .from("newsletter_subscribers")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(EXPORT_CAP)
    .returns<Row[]>();
  if (error) {
    console.error("newsletter export failed", error.code ?? "unknown");
    throw new Error("Could not export subscribers.");
  }
  return (data ?? []).map(toSubscriber);
}
