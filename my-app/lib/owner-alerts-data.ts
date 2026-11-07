// Owner SMS alerts: settings, the send log and the sender (private tables,
// secret-key client). alertOwner never throws and never logs message text, the
// owner's number or the token.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pushOwnerAlert, pushOwnerEventOn } from "@/lib/push-data";
import { sendSms, smsTokenSet } from "@/lib/sms";
import { readSmsSettings } from "@/lib/sms-data";
import { segmentCount } from "@/lib/notifications";
import type { Order } from "@/lib/orders-data";
import {
  DEFAULT_OWNER_ALERT_SETTINGS,
  OWNER_ALERT_EVENTS,
  buildOwnerMessage,
  lowStockHits,
  ownerDedupe,
  shouldSendOwner,
  withinOwnerCap,
  type OwnerAlertEvent,
  type OwnerAlertSettings,
  type OwnerMessageData,
} from "@/lib/owner-alerts";
import { getSenderName } from "@/lib/brand-data";

type SettingsRow = {
  enabled: boolean;
  phone: string | null;
  low_stock_at: number;
} & Record<`ev_${OwnerAlertEvent}`, boolean>;

const SETTINGS_COLUMNS = `enabled, phone, low_stock_at, ${OWNER_ALERT_EVENTS.map((e) => `ev_${e}`).join(", ")}`;

function defaults(): OwnerAlertSettings {
  return { ...DEFAULT_OWNER_ALERT_SETTINGS, events: { ...DEFAULT_OWNER_ALERT_SETTINGS.events } };
}

/** Any error (including the migration not being applied yet) means "off". */
export async function getOwnerAlertSettings(): Promise<OwnerAlertSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from("owner_alert_settings")
      .select(SETTINGS_COLUMNS)
      .maybeSingle<SettingsRow>();
    if (error || !data) {
      if (error) console.error("owner alert settings unreadable", error.code ?? "unknown");
      return defaults();
    }
    const out = defaults();
    out.enabled = data.enabled === true;
    out.phone = data.phone ?? "";
    out.lowStockAt = data.low_stock_at;
    for (const e of OWNER_ALERT_EVENTS) out.events[e] = data[`ev_${e}`] !== false;
    return out;
  } catch {
    console.error("owner alert settings unreadable");
    return defaults();
  }
}

export async function saveOwnerAlertSettings(value: OwnerAlertSettings): Promise<void> {
  const update: Record<string, boolean | string | number | null> = {
    enabled: value.enabled,
    phone: value.phone === "" ? null : value.phone,
    low_stock_at: value.lowStockAt,
  };
  for (const e of OWNER_ALERT_EVENTS) update[`ev_${e}`] = value.events[e];
  const { error } = await supabaseAdmin
    .from("owner_alert_settings")
    .upsert({ id: true, ...update }, { onConflict: "id" });
  if (error) {
    console.error("owner alert settings save failed", error.code ?? "unknown");
    throw new Error("owner alert settings save failed");
  }
}

/** Fail closed: a count that errors counts as over the cap. */
async function underOwnerCap(): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("owner_alerts")
    .select("id", { count: "exact", head: true })
    .in("status", ["sent", "failed"])
    .gte("created_at", since);
  if (error || count === null) return false;
  return withinOwnerCap(count);
}

/**
 * Logs (and, when allowed, sends) one alert to the owner. The log row is claimed
 * before sending, so a repeated call for the same subject is a no-op. Never throws.
 */
export async function alertOwner(data: OwnerMessageData, subject: string, day?: string): Promise<void> {
  // The owner's phone/browser gets a push too, independent of the SMS switch (never throws).
  await pushOwnerAlert(data, subject, day);
  try {
    const [settings, sms] = await Promise.all([getOwnerAlertSettings(), readSmsSettings()]);
    const decision = shouldSendOwner({
      settings,
      event: data.event,
      tokenSet: smsTokenSet(),
      senderId: sms.settings.senderId,
    });
    // While the switch is off nothing is logged: turning it on later must not
    // be flooded, and a disabled feature should cost no database writes.
    if (!settings.enabled) return;

    let capOk = true;
    if (decision === "send") capOk = await underOwnerCap();

    const body = buildOwnerMessage(data, await getSenderName({ ascii: true }));
    const { data: row, error } = await supabaseAdmin
      .from("owner_alerts")
      .insert({
        event: data.event,
        dedupe: ownerDedupe(data.event, subject, day),
        body,
        segments: segmentCount(body),
        status: decision === "send" && capOk ? "failed" : "skipped",
      })
      .select("id")
      .single<{ id: string }>();
    if (error) {
      // 23505: already claimed by an earlier call; nothing more to do.
      if (error.code !== "23505") console.error("owner alert log failed", error.code ?? "unknown");
      return;
    }
    if (decision !== "send" || !capOk) return;

    const ok = await sendSms(settings.phone, body, sms.settings.senderId);
    if (ok) {
      const { error: updateError } = await supabaseAdmin
        .from("owner_alerts")
        .update({ status: "sent" })
        .eq("id", row.id);
      if (updateError) console.error("owner alert update failed", updateError.code ?? "unknown");
    }
  } catch (e) {
    console.error("owner alert error", e instanceof Error ? e.name : "unknown");
  }
}

export async function alertNewOrder(order: Order): Promise<void> {
  await alertOwner(
    { event: "new_order", orderNumber: order.orderNumber, total: order.total, advanceAmount: order.advanceAmount },
    order.id,
  );
}

const colomboDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" });

/** After an order took stock: one alert per size now at or under the threshold (once per size per day). */
export async function alertLowStock(items: Order["items"]): Promise<void> {
  try {
    const settings = await getOwnerAlertSettings();
    // Work out low stock when the owner wants it by SMS or by push; each channel then decides for itself.
    const smsWanted = settings.enabled && settings.events.low_stock;
    if (!smsWanted && !(await pushOwnerEventOn("low_stock"))) return;
    const ids = [...new Set(items.flatMap((item) => (item.productId ? [item.productId] : [])))];
    if (ids.length === 0) return;
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("id, stock")
      .in("id", ids)
      .returns<{ id: string; stock: Record<string, number> | null }[]>();
    if (error) {
      console.error("low stock lookup failed", error.code ?? "unknown");
      return;
    }
    const stock = new Map(data.map((row) => [row.id, row.stock]));
    const hits = lowStockHits(
      items.flatMap((item) =>
        item.productId ? [{ productId: item.productId, productName: item.productName, size: item.size }] : [],
      ),
      stock,
      settings.lowStockAt,
    );
    const day = colomboDay.format(new Date());
    for (const hit of hits) {
      await alertOwner(
        { event: "low_stock", productName: hit.productName, size: hit.size, left: hit.left },
        `${hit.productId}:${hit.size}`,
        day,
      );
    }
  } catch (e) {
    console.error("low stock alert error", e instanceof Error ? e.name : "unknown");
  }
}

export type OwnerAlertRow = {
  id: string;
  event: OwnerAlertEvent;
  status: "sent" | "failed" | "skipped";
  segments: number;
  createdAt: string;
};

export async function listOwnerAlerts(limit = 50): Promise<OwnerAlertRow[]> {
  const { data, error } = await supabaseAdmin
    .from("owner_alerts")
    .select("id, event, status, segments, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<{ id: string; event: OwnerAlertEvent; status: "sent" | "failed" | "skipped"; segments: number; created_at: string }[]>();
  if (error) {
    console.error("owner alerts query failed", error.code ?? "unknown");
    throw new Error("owner alerts query failed");
  }
  return data.map((r) => ({ id: r.id, event: r.event, status: r.status, segments: r.segments, createdAt: r.created_at }));
}
