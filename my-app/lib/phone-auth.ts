// Phone sign-in: request a code by SMS, then verify it.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/orders";
import { generateCode, hashCode, isValidCodeInput, otpMessage } from "@/lib/otp";
import { sendSmsDetailed } from "@/lib/sms";
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
  const outcome = await sendSmsDetailed(phone, otpMessage(code), senderId);
  if (!outcome.sent) {
    // Only a definite provider failure gives the code back. After a timeout the
    // SMS may have been delivered, so the code stays valid.
    if (outcome.definite) {
      const { error: cancelError } = await supabaseAdmin.rpc("cancel_phone_code", {
        p_phone: phone,
        p_code_hash: codeHash,
      });
      if (cancelError) console.error("cancel_phone_code failed", cancelError.code ?? "unknown");
    }
    return "send_failed";
  }
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
