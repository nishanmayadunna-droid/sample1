// Pure rules for the advance payment: how much, who pays it, settings
// validation and slip file paths. No I/O, so they are shared by the Server
// Actions, the admin form and the unit tests. All money is in cents.
import { parsePriceToCents } from "./product-form";
import type { PaymentStatus } from "./orders";

export type AdvanceMode = "off" | "fixed" | "percent";

export type AdvanceSettings = {
  mode: AdvanceMode;
  /** The fixed advance (mode "fixed"). */
  fixed: number;
  /** Percent of the order total, 1 to 100 (mode "percent"). */
  percent: number;
  /** Smallest and largest advance in mode "percent". */
  min: number;
  max: number;
};

export type BankDetails = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  note: string;
};

/** What a customer pays up front for an order of `total` cents. */
export function advanceFor(total: number, s: AdvanceSettings): number {
  if (s.mode === "off" || total <= 0) return 0;
  const wanted =
    s.mode === "fixed"
      ? s.fixed
      : Math.min(Math.max(Math.round((total * s.percent) / 100), s.min), s.max);
  return Math.max(0, Math.min(wanted, total));
}

/** Trusted customers, and a shop with the advance switched off, order with plain COD. */
export function advanceRequired(trusted: boolean, s: AdvanceSettings): boolean {
  return !trusted && s.mode !== "off";
}

const MODES: AdvanceMode[] = ["off", "fixed", "percent"];
// Newline and tab are fine in the note; other control characters are not.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/;

function text(raw: string | undefined, max: number): string | null {
  const value = (raw ?? "").trim();
  return value.length <= max && !CONTROL_CHARS.test(value) ? value : null;
}

/** Rupees → cents; blank or "0" is allowed only when `allowZero` (the percent minimum). */
function money(raw: string | undefined, allowZero: boolean): number | null {
  const value = (raw ?? "").trim();
  if (allowZero && (value === "" || /^0+(\.0{1,2})?$/.test(value))) return 0;
  return parsePriceToCents(value);
}

export function parseAdvanceSettings(
  fields: Record<string, string | undefined>,
):
  | { ok: true; value: AdvanceSettings & BankDetails }
  | { ok: false; errors: Partial<Record<keyof (AdvanceSettings & BankDetails), string>> } {
  const errors: Partial<Record<keyof (AdvanceSettings & BankDetails), string>> = {};

  const mode = MODES.find((m) => m === fields.mode);
  if (!mode) errors.mode = "Pick a mode.";

  const fixed = money(fields.fixed, false);
  if (fixed === null) errors.fixed = "Enter an amount like 500.00 (under Rs 1,000,000).";
  const min = money(fields.min, true);
  if (min === null) errors.min = "Enter an amount like 500.00, or 0.";
  const max = money(fields.max, false);
  if (max === null) errors.max = "Enter an amount like 5000.00 (under Rs 1,000,000).";
  else if (min !== null && min > max) errors.max = "The maximum must not be below the minimum.";

  const rawPercent = (fields.percent ?? "").trim();
  const percent = /^\d{1,3}$/.test(rawPercent) ? Number(rawPercent) : NaN;
  if (!(percent >= 1 && percent <= 100)) errors.percent = "Enter a whole number from 1 to 100.";

  const bankName = text(fields.bankName, 120);
  if (bankName === null) errors.bankName = "Up to 120 characters.";
  const accountName = text(fields.accountName, 120);
  if (accountName === null) errors.accountName = "Up to 120 characters.";
  const accountNumber = text(fields.accountNumber, 120);
  if (accountNumber === null) errors.accountNumber = "Up to 120 characters.";
  const branch = text(fields.branch, 120);
  if (branch === null) errors.branch = "Up to 120 characters.";
  const note = text(fields.note, 500);
  if (note === null) errors.note = "Up to 500 characters.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      mode: mode!,
      fixed: fixed!,
      percent,
      min: min!,
      max: max!,
      bankName: bankName!,
      accountName: accountName!,
      accountNumber: accountNumber!,
      branch: branch!,
      note: note!,
    },
  };
}

export const SLIP_MAX_BYTES = 5 * 1024 * 1024;
export const MAX_SLIPS = 3;
export const SLIP_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

const SLIP_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const RAND_PATTERN = /^[a-z0-9]{6,12}$/;
const SLIP_FILE = /^\d+-[a-z0-9]{6,12}\.(jpg|png|webp|pdf)$/;

/** `<order id>/<now>-<rand>.<ext>`, or null for an unsupported type or a bad `rand`. */
export function slipPathFor(orderId: string, contentType: string, now: number, rand: string): string | null {
  const ext = Object.hasOwn(SLIP_EXTENSIONS, contentType) ? SLIP_EXTENSIONS[contentType] : undefined;
  return ext && RAND_PATTERN.test(rand) ? `${orderId}/${now}-${rand}.${ext}` : null;
}

/** True only for a file name we issued, directly inside this order's folder. */
export function isValidSlipPath(orderId: string, path: string): boolean {
  const prefix = `${orderId}/`;
  return orderId !== "" && path.startsWith(prefix) && SLIP_FILE.test(path.slice(prefix.length));
}

const PAYMENT_LABELS: Record<PaymentStatus, { si: string; en: string }> = {
  unpaid: { si: "බඩු ලැබෙන විට ගෙවන්න", en: "Pay on delivery" },
  advance_due: { si: "advance ගෙවීම අවශ්‍යයි", en: "Advance due" },
  slip_uploaded: { si: "slip එක පරීක්ෂා කරමින්", en: "Slip being checked" },
  advance_paid: { si: "advance ගෙවා ඇත", en: "Advance paid" },
};

export function paymentStatusLabel(status: PaymentStatus): { si: string; en: string } {
  return PAYMENT_LABELS[status];
}
