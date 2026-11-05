// Order SMS notifications: settings, the send log and the sender (private
// tables, secret-key client). notifyOrder never throws and never logs message
// text, phone numbers or the token.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendSms, smsTokenSet } from "@/lib/sms";
import { getSmsSettings } from "@/lib/sms-data";
import { getStoreSettings } from "@/lib/storefront";
import { getPaymentSettings } from "@/lib/payments-data";
import { advanceDeadline } from "@/lib/advance";
import { getOrderForAdmin, type Order } from "@/lib/orders-data";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_EVENTS,
  buildMessage,
  dedupeKey,
  segmentCount,
  shouldSend,
  type MessageData,
  type NotificationEvent,
  type NotificationSettings,
} from "@/lib/notifications";

type SettingsRow = { enabled: boolean } & Record<`ev_${NotificationEvent}`, boolean>;

const SETTINGS_COLUMNS = `enabled, ${NOTIFICATION_EVENTS.map((e) => `ev_${e}`).join(", ")}`;

function defaults(): NotificationSettings {
  return { enabled: false, events: { ...DEFAULT_NOTIFICATION_SETTINGS.events } };
}

/** Any error (including the migration not being applied yet) means "off". */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from("notification_settings")
      .select(SETTINGS_COLUMNS)
      .maybeSingle<SettingsRow>();
    if (error || !data) {
      if (error) console.error("notification settings unreadable", error.code ?? "unknown");
      return defaults();
    }
    const out = defaults();
    out.enabled = data.enabled === true;
    for (const e of NOTIFICATION_EVENTS) out.events[e] = data[`ev_${e}`] !== false;
    return out;
  } catch {
    console.error("notification settings unreadable");
    return defaults();
  }
}

export async function saveNotificationSettings(value: NotificationSettings): Promise<void> {
  const update: Record<string, boolean> = { enabled: value.enabled };
  for (const e of NOTIFICATION_EVENTS) update[`ev_${e}`] = value.events[e];
  const { error } = await supabaseAdmin
    .from("notification_settings")
    .upsert({ id: true, ...update }, { onConflict: "id" });
  if (error) {
    console.error("notification settings save failed", error.code ?? "unknown");
    throw new Error("notification settings save failed");
  }
}

type NotifyOptions = { slipId?: string; rejectReason?: string; lastReviewedAt?: string | null };

/**
 * Logs (and, when allowed, sends) the SMS for an order event. The log row is
 * claimed before sending, so a repeated call for the same event is a no-op.
 * Never throws.
 */
export async function notifyOrder(
  order: Order,
  event: NotificationEvent,
  opts: NotifyOptions = {},
): Promise<void> {
  try {
    // An advance order gets one SMS: the advance text, under the advance_due event.
    const actual: NotificationEvent =
      event === "placed" && order.advanceAmount > 0 ? "advance_due" : event;

    const [settings, sms, store, payment] = await Promise.all([
      getNotificationSettings(),
      getSmsSettings(),
      getStoreSettings(),
      actual === "advance_due"
        ? getPaymentSettings().catch(() => ({ expiryHours: 0 }))
        : Promise.resolve(null),
    ]);

    const data: MessageData = {
      orderNumber: order.orderNumber,
      total: order.total,
      advanceAmount: order.advanceAmount,
      payBefore: payment
        ? advanceDeadline(order.createdAt, opts.lastReviewedAt ?? null, payment.expiryHours)
        : null,
      courierName: order.courierName,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      pointsEarned: order.pointsToEarn,
      systemCancelled: order.cancelReason === "advance_expired",
      rejectReason: opts.rejectReason,
    };
    const body = buildMessage(actual, data, store.defaultLang);

    const decision = shouldSend({
      settings,
      event: actual,
      tokenSet: smsTokenSet(),
      phone: order.phone,
      senderId: sms.senderId,
    });

    const { data: row, error } = await supabaseAdmin
      .from("order_notifications")
      .insert({
        order_id: order.id,
        channel: "sms",
        event: actual,
        dedupe: dedupeKey(actual, opts.slipId),
        phone: order.phone,
        body,
        segments: segmentCount(body),
        status: decision === "send" ? "failed" : "skipped",
      })
      .select("id")
      .single<{ id: string }>();
    if (error) {
      // 23505: already claimed by an earlier call; nothing more to do.
      if (error.code !== "23505") console.error("notification log failed", error.code ?? "unknown");
      return;
    }
    if (decision !== "send") return;

    const ok = await sendSms(order.phone, body, sms.senderId);
    if (ok) {
      const { error: updateError } = await supabaseAdmin
        .from("order_notifications")
        .update({ status: "sent" })
        .eq("id", row.id);
      if (updateError) console.error("notification update failed", updateError.code ?? "unknown");
    }
  } catch (e) {
    console.error("notification error", e instanceof Error ? e.name : "unknown");
  }
}

/** Notifies recent system-cancelled advance orders; the log's dedupe makes repeats no-ops. */
export async function sweepStaleCancelNotices(): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("order_number")
      .eq("status", "cancelled")
      .eq("cancel_reason", "advance_expired")
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<{ order_number: string }[]>();
    if (error) {
      console.error("cancel notice sweep failed", error.code ?? "unknown");
      return;
    }
    for (const { order_number } of data) {
      const order = await getOrderForAdmin(order_number);
      if (order) await notifyOrder(order, "cancelled");
    }
  } catch (e) {
    console.error("cancel notice sweep error", e instanceof Error ? e.name : "unknown");
  }
}

export type NotificationRow = {
  id: string;
  orderNumber: string;
  event: NotificationEvent;
  status: "sent" | "failed" | "skipped";
  segments: number;
  createdAt: string;
};

type LogRow = {
  id: string;
  event: NotificationEvent;
  status: "sent" | "failed" | "skipped";
  segments: number;
  created_at: string;
  orders: { order_number: string } | null;
};

export async function listNotifications(limit = 100): Promise<NotificationRow[]> {
  const { data, error } = await supabaseAdmin
    .from("order_notifications")
    .select("id, event, status, segments, created_at, orders(order_number)")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<LogRow[]>();
  if (error) {
    console.error("notifications query failed", error.code ?? "unknown");
    throw new Error("notifications query failed");
  }
  return data.map((r) => ({
    id: r.id,
    orderNumber: r.orders?.order_number ?? "",
    event: r.event,
    status: r.status,
    segments: r.segments,
    createdAt: r.created_at,
  }));
}

/** Sends a failed message again using its stored text and number. */
export async function resendNotification(
  id: string,
): Promise<"ok" | "not_found" | "not_failed" | "failed_again"> {
  try {
    const { data: row, error } = await supabaseAdmin
      .from("order_notifications")
      .select("id, event, phone, body, status")
      .eq("id", id)
      .maybeSingle<{ id: string; event: NotificationEvent; phone: string; body: string; status: string }>();
    if (error) {
      console.error("notification lookup failed", error.code ?? "unknown");
      return "failed_again";
    }
    if (!row) return "not_found";
    if (row.status !== "failed") return "not_failed";

    const [settings, sms] = await Promise.all([getNotificationSettings(), getSmsSettings()]);
    const decision = shouldSend({
      settings,
      event: row.event,
      tokenSet: smsTokenSet(),
      phone: row.phone,
      senderId: sms.senderId,
    });
    if (decision !== "send") return "failed_again";

    // Claim atomically before sending so two concurrent clicks cannot both send.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("order_notifications")
      .update({ status: "sent" })
      .eq("id", row.id)
      .eq("status", "failed")
      .select("id");
    if (claimError) {
      console.error("notification claim failed", claimError.code ?? "unknown");
      return "failed_again";
    }
    if (!claimed || claimed.length === 0) return "not_failed";

    const ok = await sendSms(row.phone, row.body, sms.senderId);
    if (!ok) {
      const { error: revertError } = await supabaseAdmin
        .from("order_notifications")
        .update({ status: "failed" })
        .eq("id", row.id);
      if (revertError) console.error("notification revert failed", revertError.code ?? "unknown");
      return "failed_again";
    }
    return "ok";
  } catch (e) {
    console.error("notification resend error", e instanceof Error ? e.name : "unknown");
    return "failed_again";
  }
}
