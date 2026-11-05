// Phone sign-in: request a code by SMS, then verify it.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/orders";
import { generateCode, hashCode, isValidCodeInput, otpMessage } from "@/lib/otp";
import { sendSms } from "@/lib/sms";
import { getSmsSettings, smsAvailable } from "@/lib/sms-data";
import { createPhoneUser, findUserByPhone, type AppUser } from "@/lib/users";

export type RequestResult =
  | "sent"
  | "invalid_phone"
  | "unavailable"
  | "too_soon"
  | "hourly_limit"
  | "daily_cap"
  | "send_failed";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export async function requestPhoneCode(rawPhone: string): Promise<RequestResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return "invalid_phone";
  if (!(await smsAvailable())) return "unavailable";

  const code = generateCode();
  const codeHash = hashCode(phone, code, secret());
  const { data, error } = await supabaseAdmin.rpc("request_phone_code", {
    p_phone: phone,
    p_code_hash: codeHash,
  });
  if (error) {
    console.error("request_phone_code failed", error.code ?? "unknown");
    return "unavailable";
  }
  if (data === "too_soon" || data === "hourly_limit" || data === "daily_cap") return data;
  if (data !== "ok") return "unavailable";

  const { senderId } = await getSmsSettings();
  // A failed send keeps its row on purpose: the SMS may still have been
  // delivered and billed, so it must keep counting toward the caps.
  if (!(await sendSms(phone, otpMessage(code), senderId))) return "send_failed";
  return "sent";
}

export async function verifyPhoneCode(
  rawPhone: string,
  rawCode: string,
): Promise<AppUser | null> {
  const phone = normalizePhone(rawPhone);
  const code = rawCode.trim();
  if (!phone || !isValidCodeInput(code)) return null;
  if (!(await smsAvailable())) return null;

  const { data, error } = await supabaseAdmin.rpc("verify_phone_code", {
    p_phone: phone,
    p_code_hash: hashCode(phone, code, secret()),
  });
  if (error) {
    console.error("verify_phone_code failed", error.code ?? "unknown");
    return null;
  }
  if (data !== "ok") return null;
  return (await findUserByPhone(phone)) ?? (await createPhoneUser(phone));
}
