# Part 9: Phone sign-in with SMS code — design

Status: approved in chat by the owner (option B, Text.lk, admin on/off).

## Goal
Customers can sign up and sign in with a mobile number and a one-time SMS code, next to the existing email/Google sign-in. The admin controls whether it exists at all and caps the daily SMS spend.

## Decisions (from the owner)
- B: phone + code is **added**; email/password and Google stay.
- SMS provider: **Text.lk**. Roughly Rs 0.64–0.84 per SMS (to be confirmed on their rate card).
- **Admin switch, default OFF.** Until an admin turns it on, `/signin` looks and behaves as today.
- Accounts are **never linked** (same rule as email/Google): a phone account is its own account.

## Out of scope
Password reset, linking a phone to an email account, changing a phone number, order-status SMS, WhatsApp.

## Accounts
- `users.phone text unique` (normalised `07XXXXXXXX` by the existing `normalizePhone`); `users.email` becomes nullable; the row check becomes: at least one of `password_hash`, `google_id`, `phone`.
- A phone user has `email = null`. Display name falls back to the phone number (header, `/account`, `/admin/customers`). Nothing else reads `email` for logic (checked: `payments-data.ts` only displays it).
- New users get `role = 'user'`; name is empty until they fill checkout details.

## Codes
- Private table `public.phone_otps` (`id`, `phone`, `code_hash`, `expires_at`, `attempts`, `created_at`, `used_at`); RLS on, no policies, no grants.
- 6 digits from `crypto.randomInt`, stored as an HMAC-SHA256 hash keyed with `AUTH_SECRET` (never the code itself).
- Valid 5 minutes, one use, at most 5 wrong attempts per code, then it is dead.
- Send limits per phone: at least 60 s between sends, at most 5 per hour. Sending again invalidates the older codes.
- **Daily cap** (`sms_settings.daily_cap`, default 200 sends across the shop, counted from `phone_otps` rows since midnight Asia/Colombo): when reached, sign-in by phone answers "try again later" and nothing is sent. This is the budget guard against abuse.
- Same neutral answer whether or not the number already has an account (no account probing).

## Sending (Text.lk)
- `POST https://app.text.lk/api/v3/sms/send`, headers `Authorization: Bearer <token>`, `Content-Type`/`Accept: application/json`, body `{ recipient: "94XXXXXXXXX", sender_id, type: "plain", message }`. We make and verify the code ourselves (`plain`), so the code never depends on the provider's response.
- Token only in the server env var `TEXTLK_API_TOKEN` (never in the database, the repo or chat). Missing token = feature unavailable; the admin page says "token not set".
- Message (Sinhala + English, short): "Northbound code: 123456. Valid 5 minutes."
- If Text.lk fails (HTTP error, `status != success`, timeout 8 s) the code row is removed and the user sees a generic "could not send, try again".

## Sign-in flow
1. `/signin` shows a Phone tab only when `sms_settings.enabled` and the token is set.
2. Step 1 form: phone → server action `requestPhoneCode` (message **codes** back, like `lib/auth-messages.ts`).
3. Step 2 form: 6-digit code → Auth.js Credentials provider `phone` (`phone`, `code`): verifies against the newest live code (constant-time compare via hash), marks it used, finds the user by phone or creates it, returns `{ id, name, email, image, role }` like the other provider. Full-navigation sign-in as today.
4. `requireUser`, `proxy.ts`, carts, orders and points are unchanged: they key on the user id.

## Admin `/admin/sms`
Switch (default off), sender ID, daily cap, "sent today / cap", token status (set / not set, never the value). `requireAdmin` first; settings in `public.sms_settings` (single row, private like `payment_settings`). Turning it on is refused while the token is not set or the sender ID is empty. Linked from `AdminTabs`.

## Pure, tested rules (`lib/otp.ts`)
`generateCode`, `hashCode(code, secret)`, `verifyCode`, `isExpired`, `canSend(history, now)` (60 s / 5 per hour), `withinDailyCap`, `toTextlkRecipient("07XXXXXXXX") → "94XXXXXXXXX"`, `parseSmsSettings`. Network and DB code stays thin (`lib/sms.ts`, `lib/phone-auth.ts`, both `server-only`).

## Migration
`20261108100000_phone_signin.sql`: users changes, `phone_otps`, `sms_settings` (enabled false), RLS/revokes. Additive; production keeps working before and after it (nothing reads the new columns until the feature is on). The owner runs it in the SQL editor before the code is deployed.

## Verification
Unit tests for every pure rule; `tsc`, lint, build (`/` and `/products/[id]` stay static; only `/signin` and `/admin/sms` are dynamic). Manual: with the owner's Text.lk account topped up (~Rs 100), real phone: send, wrong code ×5, expired code, resend limits, daily cap set to 1, off-switch hides the tab.

## Risks to review
OTP brute force and SMS-pumping abuse (limits above), account probing, a phone user with no email in any code path, cookie/session parity with the other providers.
