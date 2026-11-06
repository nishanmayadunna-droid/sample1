# Email: order emails, password reset, email verification, newsletter double opt-in (Part 11)

## Understanding

The shop had no email at all: no password reset, no way to confirm an address, a newsletter anyone could subscribe any address to, and order updates only by SMS. This part adds all four, over a small provider-agnostic sender (Resend's HTTP API, no new dependency). The owner has no domain yet, so it ships **OFF**: nothing is sent until `RESEND_API_KEY` and `EMAIL_FROM` are set and the admin switches it on at `/admin/email`. Resend only delivers to arbitrary recipients from a verified domain; until then it delivers only to the account owner's own address, which is enough to test.

Assumptions: every email is bilingual (English then Sinhala; subjects carry both) because an email has no language cookie; verification is **soft** (it never blocks sign-in or ordering); a reset only works for password accounts; password reset also counts as verifying the address; no newsletter campaigns are sent from the app yet.

## Constraints

- **Nothing leaks who has an account.** The reset request and the newsletter form give the same answer whether or not the address is known; the newsletter form confirms an address only by email.
- **Links are single-use and safe to open.** Tokens are 256-bit random, only their SHA-256 hash is stored, they expire (reset 1 hour, verify 48 hours, newsletter 7 days), and opening a link changes nothing: the page shows a form or a button and the change is a Server Action POST (mail scanners open links). Token pages send `referrer: no-referrer` and `noindex`.
- **Abuse limits are in the database.** `create_auth_token`: 3 per kind per person per hour (a new token retires the old one). `rate_limit_hit`: per-IP buckets (reset 5/hour, newsletter 5/hour), keyed by an HMAC of the IP so addresses are not stored; a database error counts as over the limit. A daily cap of 300 emails (fail closed).
- Every message is claimed in `email_log` (`unique (kind, dedupe)`) before it is sent, so a repeat sends nothing; recipients are stored masked; tokens, bodies and full addresses are never logged. `sendEmail` never throws into a customer's action.
- All new tables have RLS with no grants; the migration is additive. `subscribe_newsletter` (single opt-in) stays in the database but is no longer called.

## Data (`20261117100000_email.sql`)

`users.email_verified_at`; `email_settings` (one row, `enabled` false, `order_emails` true); `email_log`; `auth_tokens`; `rate_hits`; `newsletter_subscribers.confirmed_at / confirm_token_hash / confirm_expires_at / confirm_sent_at`; functions `rate_limit_hit`, `create_auth_token`, `consume_auth_token`, `request_newsletter_subscription`, `confirm_newsletter` (all `service_role` only).

## Flows

- **Password reset:** `/forgot-password` → `requestPasswordResetAction` (neutral answer) → email with `/reset-password?token=` → form → `resetPasswordAction` (consume token, set password with bcrypt cost 12, mark verified). Sessions are JWTs, so an already-signed-in session is not revoked by a reset (a known limitation).
- **Email verification:** sign-up sends a link (best effort); `/verify-email?token=` has a Confirm button; `/account` shows a banner with a resend button while the address is unconfirmed and email is on. Google accounts count as verified.
- **Newsletter:** the footer form stores the address with a hashed token and emails a confirmation; `/newsletter/confirm?token=` has a button. Only confirmed, not-unsubscribed addresses count as active and are exported. With email off the form says sign-ups are not open yet (nothing is stored). An unsubscribed address stays suppressed.
- **Order emails:** `notifyOrder` also calls `emailOrderEvent` (same events and wording as the SMS, both languages, plus a link to the order) for customers who have an email address; independent of the SMS switch.

## Pure rules (`lib/email.ts`, tested)

Tokens (`generateToken`, `hashToken`, `isTokenShape`), `isDeliverableEmail` (no header injection or second recipient), `maskEmail`, `isValidFrom`, `clientIp`, `tokenLink`, the bilingual templates (HTML escaped), `parseEmailSettings`, the daily cap.

## Going live (owner)

Create a Resend account, verify the shop's domain, put `RESEND_API_KEY` and `EMAIL_FROM` in `.env.local` and Vercel, set `NEXT_PUBLIC_SITE_URL`, switch email on at `/admin/email`, and send yourself a password reset to test.

## Out of scope

Newsletter campaigns, bounce and complaint handling, email change, revoking sessions after a password reset, per-user language for email.
