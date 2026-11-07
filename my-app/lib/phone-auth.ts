// Phone sign-in: request a code by SMS, then verify it.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/orders";
import { generateCode, hashCode, isValidCodeInput, otpMessage } from "@/lib/otp";
import { sendSms } from "@/lib/sms";
import { getSmsSettings, smsAvailable } from "@/lib/sms-data";
import { createPhoneUser, findUserByPhone, type AppUser } from "@/lib/users";
import { getSenderName } from "@/lib/brand-data";

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
  if (!(await sendSms(phone, otpMessage(code, await getSenderName()), senderId))) return "send_failed";
  return "sent";
}

/**
 * Checks a code for an already-normalised phone and uses it up when right.
 * The database counts every guess, so this is safe to call with user input.
 */
export async function checkPhoneCode(phone: string, rawCode: string): Promise<boolean> {
  const code = rawCode.trim();
  if (!isValidCodeInput(code)) return false;
  if (!(await smsAvailable())) return false;

  const { data, error } = await supabaseAdmin.rpc("verify_phone_code", {
    p_phone: phone,
    p_code_hash: hashCode(phone, code, secret()),
  });
  if (error) {
    console.error("verify_phone_code failed", error.code ?? "unknown");
    return false;
  }
  return data === "ok";
}

export async function verifyPhoneCode(
  rawPhone: string,
  rawCode: string,
): Promise<AppUser | null> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  if (!(await checkPhoneCode(phone, rawCode))) return null;
  return (await findUserByPhone(phone)) ?? (await createPhoneUser(phone));
}
