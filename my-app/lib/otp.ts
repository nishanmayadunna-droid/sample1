import { createHmac, randomInt } from "node:crypto";
import { normalizePhone } from "./orders";

export const DEFAULT_DAILY_CAP = 200;
export const MAX_DAILY_CAP = 5000;

export type SmsSettings = { enabled: boolean; senderId: string; dailyCap: number };

/** Six digits, zero-padded. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Hex HMAC-SHA256 of `${phone}:${code}`; the code itself is never stored. */
export function hashCode(phone: string, code: string, secret: string): string {
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

/** `07XXXXXXXX` -> `94XXXXXXXXX` (Text.lk format), else null. */
export function toTextlkRecipient(phone: string): string | null {
  const local = normalizePhone(phone);
  if (!local || local !== phone) return null;
  return `94${local.slice(1)}`;
}

export function otpMessage(code: string, brandName: string): string {
  return `${brandName} code: ${code}. Valid 5 minutes.`;
}

export function isValidCodeInput(raw: string): boolean {
  return /^\d{6}$/.test(raw);
}

export function parseSmsSettings(
  fields: Record<string, string | undefined>,
): { ok: true; value: SmsSettings } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const enabled = fields.enabled === "on";
  const senderId = (fields.senderId ?? "").trim();

  if (enabled && senderId === "") {
    errors.senderId = "Sender ID is required while SMS is on.";
  } else if (senderId !== "" && !/^[A-Za-z0-9 ]{3,11}$/.test(senderId)) {
    errors.senderId = "Sender ID must be 3-11 letters, digits or spaces.";
  }

  const rawCap = (fields.dailyCap ?? "").trim();
  let dailyCap = DEFAULT_DAILY_CAP;
  if (rawCap !== "") {
    if (!/^\d+$/.test(rawCap) || Number(rawCap) < 1 || Number(rawCap) > MAX_DAILY_CAP) {
      errors.dailyCap = `Daily limit must be a whole number from 1 to ${MAX_DAILY_CAP}.`;
    } else {
      dailyCap = Number(rawCap);
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { enabled, senderId, dailyCap } };
}
