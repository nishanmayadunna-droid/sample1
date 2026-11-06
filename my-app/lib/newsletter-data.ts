// Newsletter subscribers (private table, secret-key client). Never log emails or tokens.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { emailAvailable, sendNewsletterConfirmation } from "@/lib/email-data";
import { generateToken, hashToken, isTokenShape } from "@/lib/email";

export type Subscriber = {
  id: string;
  email: string;
  source: string;
  createdAt: string;
  unsubscribedAt: string | null;
  /** When the owner of the address clicked the confirmation link (double opt-in). */
  confirmedAt: string | null;
};

type Row = {
  id: string;
  email: string;
  source: string;
  created_at: string;
  unsubscribed_at: string | null;
  confirmed_at: string | null;
};

const COLUMNS = "id, email, source, created_at, unsubscribed_at, confirmed_at";
const EXPORT_CAP = 10000;

function toSubscriber(r: Row): Subscriber {
  return {
    id: r.id,
    email: r.email,
    source: r.source,
    createdAt: r.created_at,
    unsubscribedAt: r.unsubscribed_at,
    confirmedAt: r.confirmed_at,
  };
}

/**
 * Double opt-in. An address is stored with a hashed confirmation token and a
 * confirmation email is sent; it only counts once its owner clicks the link. The
 * answer is the same whether or not the address was already known ("confirm"),
 * so the form cannot be used to find out who is subscribed. When email is not
 * switched on nothing is stored ("unavailable"): a row nobody can confirm is useless.
 */
export async function subscribeEmail(
  email: string,
  source: string,
): Promise<"confirm" | "busy" | "unavailable" | "error"> {
  try {
    if (!(await emailAvailable())) return "unavailable";
    const token = generateToken();
    const { data, error } = await supabaseAdmin.rpc("request_newsletter_subscription", {
      p_email: email,
      p_source: source,
      p_hash: hashToken(token),
    });
    if (error) {
      console.error("newsletter subscribe failed", error.code ?? "unknown");
      return "error";
    }
    if (data === "busy") return "busy";
    if (data === "send") await sendNewsletterConfirmation(email, token);
    if (data === "send" || data === "noop") return "confirm";
    return "error";
  } catch {
    console.error("newsletter subscribe failed");
    return "error";
  }
}

/** The link in the confirmation email. The token works once and only for a not-yet-unsubscribed address. */
export async function confirmNewsletterToken(token: string): Promise<"ok" | "invalid" | "error"> {
  if (!isTokenShape(token)) return "invalid";
  try {
    const { data, error } = await supabaseAdmin.rpc("confirm_newsletter", { p_hash: hashToken(token) });
    if (error) {
      console.error("newsletter confirm failed", error.code ?? "unknown");
      return "error";
    }
    return data === "ok" ? "ok" : "invalid";
  } catch {
    console.error("newsletter confirm failed");
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
): Promise<{ rows: Subscriber[]; active: number; unsubscribed: number; pending: number }> {
  const [rowsRes, activeRes, unsubRes, pendingRes] = await Promise.all([
    supabaseAdmin
      .from("newsletter_subscribers")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<Row[]>(),
    supabaseAdmin
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .is("unsubscribed_at", null)
      .not("confirmed_at", "is", null),
    supabaseAdmin
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .not("unsubscribed_at", "is", null),
    supabaseAdmin
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .is("unsubscribed_at", null)
      .is("confirmed_at", null),
  ]);
  if (rowsRes.error || activeRes.error || unsubRes.error || pendingRes.error) {
    const code =
      rowsRes.error?.code ?? activeRes.error?.code ?? unsubRes.error?.code ?? pendingRes.error?.code ?? "unknown";
    console.error("newsletter list failed", code);
    throw new Error("Could not load subscribers.");
  }
  return {
    rows: (rowsRes.data ?? []).map(toSubscriber),
    active: activeRes.count ?? 0,
    unsubscribed: unsubRes.count ?? 0,
    pending: pendingRes.count ?? 0,
  };
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteSubscriber(id: string): Promise<void> {
  if (!UUID_SHAPE.test(id)) throw new Error("Invalid subscriber id.");
  const { error } = await supabaseAdmin.from("newsletter_subscribers").delete().eq("id", id);
  if (error) {
    console.error("newsletter delete failed", error.code ?? "unknown");
    throw new Error("Could not delete the subscriber.");
  }
}

export async function exportSubscribers(): Promise<Subscriber[]> {
  const PAGE = 1000;
  const out: Subscriber[] = [];
  while (out.length < EXPORT_CAP) {
    const from = out.length;
    const { data, error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select(COLUMNS)
      // Only addresses that confirmed by email are ever exported for mailing.
      .not("confirmed_at", "is", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
      .returns<Row[]>();
    if (error) {
      console.error("newsletter export failed", error.code ?? "unknown");
      throw new Error("Could not export subscribers.");
    }
    const rows = data ?? [];
    out.push(...rows.map(toSubscriber));
    if (rows.length < PAGE) break;
  }
  return out.slice(0, EXPORT_CAP);
}
