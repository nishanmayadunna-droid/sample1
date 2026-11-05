// Text.lk SMS sending. The API token is read only from the environment here.
import "server-only";
import { toTextlkRecipient } from "@/lib/otp";

const ENDPOINT = "https://app.text.lk/api/v3/sms/send";

export function smsTokenSet(): boolean {
  return (process.env.TEXTLK_API_TOKEN ?? "") !== "";
}

/** True when Text.lk accepted the message. Never logs the token or the message. */
export async function sendSms(
  phone: string,
  message: string,
  senderId: string,
): Promise<boolean> {
  const recipient = toTextlkRecipient(phone);
  if (!recipient || !smsTokenSet()) return false;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TEXTLK_API_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient,
        sender_id: senderId,
        type: "plain",
        message,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    const ok = res.ok && body?.status === "success";
    if (!ok) {
      console.error("sms send rejected", { httpStatus: res.status, status: body?.status });
    }
    return ok;
  } catch (e) {
    console.error("sms send error", e instanceof Error ? e.name : "unknown");
    return false;
  }
}
