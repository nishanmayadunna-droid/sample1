// SMS settings and usage (private tables, secret-key client).
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_DAILY_CAP, type SmsSettings } from "@/lib/otp";
import { smsTokenSet } from "@/lib/sms";

const OFF: SmsSettings = { enabled: false, senderId: "", dailyCap: DEFAULT_DAILY_CAP };

type Row = { enabled: boolean; sender_id: string; daily_cap: number };

/** Any error (including the migration not being applied yet) means "feature off". */
export async function getSmsSettings(): Promise<SmsSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from("sms_settings")
      .select("enabled, sender_id, daily_cap")
      .maybeSingle<Row>();
    if (error) {
      console.error("sms settings unreadable", error.code ?? "unknown");
      return { ...OFF };
    }
    if (!data) return { ...OFF };
    return {
      enabled: data.enabled,
      senderId: data.sender_id ?? "",
      dailyCap: data.daily_cap ?? DEFAULT_DAILY_CAP,
    };
  } catch {
    console.error("sms settings unreadable");
    return { ...OFF };
  }
}

export async function saveSmsSettings(value: SmsSettings): Promise<void> {
  const { error } = await supabaseAdmin
    .from("sms_settings")
    .update({
      enabled: value.enabled,
      sender_id: value.senderId,
      daily_cap: value.dailyCap,
    })
    .eq("id", true);
  if (error) {
    console.error("sms settings save failed", error.code ?? "unknown");
    throw new Error("sms settings save failed");
  }
}

/** Codes sent since midnight in Sri Lanka (UTC+5:30, no DST). */
export async function countSentToday(): Promise<number> {
  const offsetMs = 5.5 * 60 * 60 * 1000;
  const local = new Date(Date.now() + offsetMs);
  local.setUTCHours(0, 0, 0, 0);
  const dayStart = new Date(local.getTime() - offsetMs).toISOString();
  try {
    const { count, error } = await supabaseAdmin
      .from("phone_otps")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayStart);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function smsAvailable(): Promise<boolean> {
  if (!smsTokenSet()) return false;
  const s = await getSmsSettings();
  return s.enabled && s.senderId !== "";
}
