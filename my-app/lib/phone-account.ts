// Link a phone number to the signed-in account, or change it. The SMS code uses
// the same functions and limits as phone sign-in (request_phone_code /
// verify_phone_code); the number itself moves in the set_user_phone SQL function.
// Server only: callers pass the session user's id, never one from the browser.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/orders";
import { checkPhoneCode, requestPhoneCode, type RequestResult } from "@/lib/phone-auth";
import { confirmMessage, type SetPhoneResult } from "@/lib/phone-change";
import type { AuthMessage } from "@/lib/auth-messages";
import { smsAvailable } from "@/lib/sms-data";
import { findUserById, findUserByPhone } from "@/lib/users";

/**
 * Step 1: text a code to the NEW number. If another account already owns the
 * number nothing is sent but the answer is still "sent", so this form cannot be
 * used to find out which numbers have accounts (the confirm step then just says
 * the code is wrong).
 */
export async function requestPhoneChangeCode(userId: string, rawPhone: string): Promise<RequestResult | "same_phone"> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return "invalid_phone";
  if (!(await smsAvailable())) return "unavailable";

  const user = await findUserById(userId);
  if (!user) return "unavailable";
  if (user.phone === phone) return "same_phone";

  const owner = await findUserByPhone(phone);
  if (owner && owner.id !== userId) return "sent";

  return requestPhoneCode(phone);
}

/** Step 2: check the code, then move the number. Returns the message to show, or null on success. */
export async function confirmPhoneChange(userId: string, rawPhone: string, rawCode: string): Promise<AuthMessage | null> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return confirmMessage("invalid_phone");
  if (!(await smsAvailable())) return confirmMessage("unavailable");

  if (!(await checkPhoneCode(phone, rawCode))) return confirmMessage("invalid_code");

  const { data, error } = await supabaseAdmin.rpc("set_user_phone", { p_user_id: userId, p_phone: phone });
  if (error) {
    console.error("set_user_phone failed", error.code ?? "unknown");
    return "somethingWrong";
  }
  const result = data as SetPhoneResult;
  return confirmMessage(result);
}
