// Pure rules for email (Part 11): one-time tokens, the message templates, the
// admin settings and request-IP helpers. No I/O and no environment access, so
// the sender, the Server Actions and the unit tests share them.
//
// Every email is bilingual (English first, then Sinhala) because an email has
// no language cookie to read; subjects carry both too.
import { createHash, randomBytes } from "node:crypto";

export const EMAIL_KINDS = ["order", "reset", "verify", "newsletter_confirm"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

/** How long each link works. */
export const RESET_TTL_SECONDS = 60 * 60; // 1 hour
export const VERIFY_TTL_SECONDS = 48 * 60 * 60; // 48 hours
export const NEWSLETTER_CONFIRM_TTL_DAYS = 7;

/** At most this many emails sent or attempted in 24 hours (stops runaway cost and abuse). */
export const EMAIL_DAILY_CAP = 300;

export function withinEmailCap(sentLast24h: number): boolean {
  return sentLast24h < EMAIL_DAILY_CAP;
}

// Tokens -------------------------------------------------------------------------------

const TOKEN_SHAPE = /^[0-9a-f]{64}$/;

/** A 256-bit random token, as 64 hex characters. Only its hash is ever stored. */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isTokenShape(value: unknown): value is string {
  return typeof value === "string" && TOKEN_SHAPE.test(value);
}

// Addresses --------------------------------------------------------------------------------

const EMAIL_SHAPE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

/** True for a plain single address; blocks anything that could smuggle headers or a second recipient. */
export function isDeliverableEmail(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_SHAPE.test(value);
}

/** "nimal@gmail.com" → "n***@gmail.com": enough to recognise, not enough to harvest. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`.slice(0, 120);
}

// Request IP -------------------------------------------------------------------------------

/** The client address from proxy headers (first x-forwarded-for entry), or "unknown". */
export function clientIp(get: (name: string) => string | null): string {
  const forwarded = get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || get("x-real-ip")?.trim() || "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(candidate) ? candidate : "unknown";
}

// Links --------------------------------------------------------------------------------------

export type LinkKind = "reset" | "verify" | "newsletter";

const LINK_PATHS: Record<LinkKind, string> = {
  reset: "/reset-password",
  verify: "/verify-email",
  newsletter: "/newsletter/confirm",
};

/** The link in the email. The token travels in the query string and is never logged. */
export function tokenLink(origin: string, kind: LinkKind, token: string): string {
  return `${origin.replace(/\/+$/, "")}${LINK_PATHS[kind]}?token=${encodeURIComponent(token)}`;
}

// Templates ----------------------------------------------------------------------------------

export type Email = { subject: string; text: string; html: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Section = { en: string; si: string };

function render(input: {
  subject: string;
  heading: Section;
  paragraphs: Section[];
  button?: { label: Section; url: string };
  footer: Section;
}): Email {
  const { subject, heading, paragraphs, button, footer } = input;
  const text = [
    heading.en,
    ...paragraphs.map((p) => p.en),
    ...(button ? [`${button.label.en}: ${button.url}`] : []),
    footer.en,
    "",
    "---",
    "",
    heading.si,
    ...paragraphs.map((p) => p.si),
    ...(button ? [`${button.label.si}: ${button.url}`] : []),
    footer.si,
  ].join("\n\n");

  const para = (value: string) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(value)}</p>`;
  const buttonHtml = button
    ? `<p style="margin:22px 0"><a href="${escapeHtml(button.url)}" style="background:#cb4a1c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block;font-weight:600">${escapeHtml(button.label.en)} / ${escapeHtml(button.label.si)}</a></p>`
    : "";
  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#15231d;max-width:560px;margin:0 auto;padding:24px">`,
    `<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading.en)}</h1>`,
    ...paragraphs.map((p) => para(p.en)),
    buttonHtml,
    para(footer.en),
    `<hr style="border:none;border-top:1px solid #dddddd;margin:22px 0" />`,
    `<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading.si)}</h1>`,
    ...paragraphs.map((p) => para(p.si)),
    para(footer.si),
    `</div>`,
  ].join("");
  return { subject, text, html };
}

const IGNORE: Section = {
  en: "If you didn't ask for this, you can ignore this email; nothing will change.",
  si: "ඔබ මෙය ඉල්ලුවේ නැත්නම්, මෙම ඊමේල් එක නොසලකා හරින්න; කිසිවක් වෙනස් නොවේ.",
};

export function resetEmail(link: string): Email {
  return render({
    subject: "Reset your Northbound password | මුරපදය යළි සකසන්න",
    heading: { en: "Reset your password", si: "මුරපදය යළි සකසන්න" },
    paragraphs: [
      { en: "Use the button below to choose a new password. The link works once and expires in 1 hour.", si: "අලුත් මුරපදයක් තෝරන්න පහත බොත්තම භාවිත කරන්න. සබැඳිය එක් වරක් පමණක් ක්‍රියා කරන අතර පැය 1කින් කල් ඉකුත් වේ." },
    ],
    button: { label: { en: "Choose a new password", si: "අලුත් මුරපදය" }, url: link },
    footer: IGNORE,
  });
}

export function verifyEmailMessage(link: string): Email {
  return render({
    subject: "Confirm your Northbound email | ඊමේල් එක තහවුරු කරන්න",
    heading: { en: "Confirm your email", si: "ඊමේල් එක තහවුරු කරන්න" },
    paragraphs: [
      { en: "Please confirm this is your email address. The link works once and expires in 48 hours.", si: "මෙය ඔබේ ඊමේල් ලිපිනය බව තහවුරු කරන්න. සබැඳිය එක් වරක් පමණක් ක්‍රියා කරන අතර පැය 48කින් කල් ඉකුත් වේ." },
    ],
    button: { label: { en: "Confirm my email", si: "තහවුරු කරන්න" }, url: link },
    footer: IGNORE,
  });
}

export function newsletterConfirmEmail(link: string): Email {
  return render({
    subject: "Confirm your Northbound subscription | දායකත්වය තහවුරු කරන්න",
    heading: { en: "One more step", si: "තව එක පියවරයි" },
    paragraphs: [
      { en: "Confirm that you want our monthly email. You will not get anything until you do.", si: "අපගේ මාසික ඊමේල් එක ලැබීමට ඔබට අවශ්‍ය බව තහවුරු කරන්න. තහවුරු කරන තුරු කිසිවක් නොලැබේ." },
    ],
    button: { label: { en: "Yes, subscribe me", si: "ඔව්, දායක කරන්න" }, url: link },
    footer: IGNORE,
  });
}

/** An order update: the same wording as the SMS in both languages, plus a link to the order. */
export function orderEmail(input: { orderNumber: string; en: string; si: string; link: string; event: string }): Email {
  const subjects: Record<string, { en: string; si: string }> = {
    placed: { en: "received", si: "ලැබුණා" },
    advance_due: { en: "needs your advance", si: "advance එක අවශ්‍යයි" },
    slip_approved: { en: "advance confirmed", si: "advance තහවුරුයි" },
    slip_rejected: { en: "slip not accepted", si: "slip එක පිළිගත නොහැක" },
    shipped: { en: "is on its way", si: "යවා ඇත" },
    delivered: { en: "delivered", si: "භාර දෙන ලදී" },
    cancelled: { en: "cancelled", si: "අවලංගුයි" },
  };
  const s = subjects[input.event] ?? { en: "update", si: "යාවත්කාලීන" };
  return render({
    subject: `Northbound order ${input.orderNumber} ${s.en} | ${s.si}`,
    heading: { en: `Order ${input.orderNumber}`, si: `ඇණවුම ${input.orderNumber}` },
    paragraphs: [{ en: input.en, si: input.si }],
    button: { label: { en: "View your order", si: "ඇණවුම බලන්න" }, url: input.link },
    footer: {
      en: "You are receiving this because you placed an order at Northbound.",
      si: "ඔබ Northbound හි ඇණවුමක් කළ නිසා මෙය ලැබේ.",
    },
  });
}

// Admin settings ----------------------------------------------------------------------------

export type EmailSettings = { enabled: boolean; orderEmails: boolean };

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = { enabled: false, orderEmails: true };

export function parseEmailSettings(fields: Record<string, string | undefined>): EmailSettings {
  return { enabled: fields.enabled === "on", orderEmails: fields.orderEmails === "on" };
}

/** The sender must look like `a@b.c` or `Name <a@b.c>` and carry no control characters or extra recipients. */
export function isValidFrom(value: string): boolean {
  if (value.length > 200 || /[\u0000-\u001F\u007F,;]/.test(value)) return false;
  const angle = /^[^<>@]{1,100}<([^<>\s@]+@[^<>\s@]+\.[^<>\s@]{2,})>$/.exec(value.trim());
  return angle ? true : EMAIL_SHAPE.test(value.trim());
}
