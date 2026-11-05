export const NEWSLETTER_DAILY_CAP = 500;

export function validateEmail(raw: string): { ok: true; email: string } | { ok: false } {
  const email = raw.trim().toLowerCase();
  if (email === "" || email.length > 254) return { ok: false };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false };
  if (/\.\.|\.$/.test(email.split("@")[1])) return { ok: false };
  return { ok: true, email };
}

export function isHoneypotFilled(value: string | null | undefined): boolean {
  return typeof value === "string" && value !== "";
}

/** CSV-safe cell: neutralises spreadsheet formulas and quotes when needed. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(
  rows: { email: string; source: string; createdAt: string; unsubscribedAt: string | null }[],
): string {
  const lines = ["email,source,subscribed_at,unsubscribed_at"];
  for (const r of rows) {
    lines.push(
      [r.email, r.source, r.createdAt, r.unsubscribedAt ?? ""].map(csvCell).join(","),
    );
  }
  return lines.join("\r\n");
}

/** Unsubscribe tokens are 64 hex characters (two uuids with the dashes removed). */
export function isUnsubscribeToken(value: string): boolean {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
}
