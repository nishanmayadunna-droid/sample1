# Phone Sign-in (Part 9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers sign up and sign in with a Sri Lankan mobile number and an SMS code (Text.lk), controlled by an admin switch that defaults to off, with a daily SMS cap.

**Architecture:** One additive migration adds `users.phone`, nullable `users.email`, the private tables `phone_otps` and `sms_settings`, and two `service_role` SQL functions that own every limit (`request_phone_code`, `verify_phone_code`) so rate limits and attempt counts are atomic. Pure helpers (code, HMAC hash, recipient format, message text, settings parsing) live in `lib/otp.ts`. Server-only modules send the SMS (`lib/sms.ts`), read/write settings (`lib/sms-data.ts`) and tie it together (`lib/phone-auth.ts`). Auth.js gets a `phone` Credentials provider; `/signin` gets a Phone tab only when the feature is live; `/admin/sms` manages it.

**Tech Stack:** Next.js 16.2 App Router, Auth.js v5 (JWT), Supabase Postgres (secret-key client), Vitest, Text.lk HTTP API.

**Spec:** `docs/superpowers/specs/2026-11-08-phone-signin-design.md`

## Global Constraints
- Next.js 16: read the relevant guide in `node_modules/next/dist/docs/` before writing Next code.
- Every customer-facing string is bilingual: `<L si en />` or `AUTH_MESSAGES` codes; server actions return message **codes**, never text. Admin pages stay English.
- Token only in env `TEXTLK_API_TOKEN` (server-only). Never print, log, commit or ask for its value. The HMAC key is `AUTH_SECRET`.
- Phone format everywhere is `07XXXXXXXX` (`normalizePhone` from `lib/orders.ts`); Text.lk recipient is `94XXXXXXXXX`.
- Code: 6 digits, valid 5 min, 5 wrong attempts max, one use; resend ≥ 60 s apart, ≤ 5 per hour per phone; daily cap default 200 (Asia/Colombo day). Feature default **off**.
- Never answer differently for a phone that already has an account (no probing).
- Accounts are never linked. Every server action starts with the right guard (`requireAdmin` for admin ones).
- Migration is additive and is run by the owner in the SQL editor before deploy; commit only when tsc, lint and tests are green; `git add` explicit paths.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Rulings
- Rate limits, the daily cap and attempt counting live **only in SQL** (atomic under an advisory lock). The spec listed TS `canSend`/`withinDailyCap`; they are dropped because a TS mirror could not be race-safe and would only duplicate. They are verified by calling the SQL functions (Task 7).

## Review Focus
- Brute force: a 6th wrong guess must fail even with the right code (test in Task 7 via SQL; unit test that `hashCode` differs per phone).
- Same `hashCode` for same input and different for different phone/code (Task 1).
- Phone user with `email = null` must not crash header, `/account`, `/admin/customers`, payments data (Task 4).
- Feature off or token missing: `/signin` shows no Phone tab and `requestPhoneCode` sends nothing (Task 5).
- Text.lk failure must remove the code row and give a generic message (Task 3).

## File Structure
- Create `lib/otp.ts`, `lib/otp.test.ts`: pure helpers.
- Create `supabase/migrations/20261108100000_phone_signin.sql`.
- Create `lib/sms.ts` (send), `lib/sms-data.ts` (settings, today's count), `lib/phone-auth.ts` (request/verify glue); all `server-only`.
- Modify `lib/users.ts` (phone user functions, nullable email), `auth.ts`, `types/next-auth.d.ts` if needed, `lib/auth-messages.ts`.
- Modify `app/signin/page.tsx`, `app/signin/SignInForm.tsx`, `app/signin/actions.ts`.
- Create `app/admin/sms/page.tsx`, `SmsSettingsForm.tsx`, `actions.ts`; modify `app/admin/AdminTabs.tsx`.
- Modify display of email in `app/account/page.tsx`, `app/admin/customers/page.tsx`, `app/components/AccountNav.tsx`, `lib/payments-data.ts`.
- Modify `CLAUDE.md`.

---

### Task 1: Pure OTP helpers

**Files:** Create `lib/otp.ts`; Test `lib/otp.test.ts`

**Interfaces:**
- Produces:
  - `generateCode(): string` (6 digits, zero-padded, `crypto.randomInt(0, 1_000_000)`)
  - `hashCode(phone: string, code: string, secret: string): string` (hex HMAC-SHA256 of `${phone}:${code}`)
  - `toTextlkRecipient(phone: string): string | null` (`07XXXXXXXX` → `94XXXXXXXXX`, else null)
  - `otpMessage(code: string): string` (`Northbound code: 123456. Valid 5 minutes.`)
  - `isValidCodeInput(raw: string): boolean` (exactly 6 digits)
  - `type SmsSettings = { enabled: boolean; senderId: string; dailyCap: number }`, `DEFAULT_DAILY_CAP = 200`, `MAX_DAILY_CAP = 5000`
  - `parseSmsSettings(fields: Record<string, string | undefined>): { ok: true; value: SmsSettings } | { ok: false; errors: Record<string, string> }` (sender id 3–11 chars `[A-Za-z0-9 ]` trimmed, required when `enabled === "on"`; dailyCap whole 1–5000)

- [ ] **Step 1: Write failing tests** for: `generateCode` always matches `/^\d{6}$/` over 200 calls; `hashCode` is stable, differs when phone or code or secret differs, never contains the code; `toTextlkRecipient("0771234567") === "94771234567"`, rejects `"771234567"`, `"0671234567"`, `""`; `isValidCodeInput` accepts `"012345"`, rejects `"12345"`, `"1234567"`, `"12345a"`, `" 123456"`; `parseSmsSettings` rejects enabled without sender id, sender `"ab"`, sender with symbols `"No!"`, cap `0`, `5001`, `"1.5"`, `"abc"`; accepts enabled=off with empty sender; trims sender.
- [ ] **Step 2:** `npx vitest run lib/otp.test.ts` → Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `lib/otp.ts` (node `crypto`; no `server-only` since tests import it, but it is only used from server code).
- [ ] **Step 4:** run the file → Expected: PASS. Then `npx tsc --noEmit && npm run lint && npm test` → Expected: all green.
- [ ] **Step 5: Commit** `lib/otp.ts lib/otp.test.ts` — "Add pure SMS code rules".

---

### Task 2: Migration

**Files:** Create `supabase/migrations/20261108100000_phone_signin.sql`

**Interfaces:**
- Produces (SQL): `users.phone text unique`; `users.email` nullable; check `users_has_login_check` (`password_hash is not null or google_id is not null or phone is not null`); table `phone_otps(id uuid pk default gen_random_uuid(), phone text not null, code_hash text not null, expires_at timestamptz not null, attempts int not null default 0, used_at timestamptz, created_at timestamptz not null default now())` + index `(phone, created_at desc)` and `(created_at)`; table `sms_settings(id boolean primary key default true check (id), enabled boolean not null default false, sender_id text not null default '', daily_cap int not null default 200 check (daily_cap between 1 and 5000))` seeded with one row; RLS on, `revoke all … from anon, authenticated` on both tables.
- `public.request_phone_code(p_phone text, p_code_hash text) returns text` → `'ok' | 'too_soon' | 'hourly_limit' | 'daily_cap'`. `security definer`, `set search_path = public`. Takes `pg_advisory_xact_lock(hashtext('sms_send'))`; reads `daily_cap`; counts `phone_otps` rows since Asia/Colombo midnight (`>= daily_cap` → `'daily_cap'`); latest row for the phone within 60 s → `'too_soon'`; rows for the phone in the last hour ≥ 5 → `'hourly_limit'`; else marks older unused codes for the phone as `used_at = now()`, inserts the new row with `expires_at = now() + interval '5 minutes'`, returns `'ok'`.
- `public.verify_phone_code(p_phone text, p_code_hash text) returns text` → `'ok' | 'invalid'`. Locks the newest row for the phone `for update`; if none, used, expired, or `attempts >= 5` → `'invalid'`; else increments `attempts`; if `code_hash` matches → set `used_at = now()` and return `'ok'`, otherwise `'invalid'`.
- `public.cancel_phone_code(p_phone text, p_code_hash text) returns void` deletes that unused row (for a failed SMS send, so a failed send does not count against the user).
- All three: `revoke … from public, anon, authenticated; grant execute … to service_role`.

- [ ] **Step 1: Write the migration** (additive, idempotent where cheap: `add column if not exists`, `drop constraint if exists`). Dropping the old check: find its name from `20261025171833_create_users.sql` (unnamed table check → Postgres name `users_check`); use `alter table public.users drop constraint if exists users_check`.
- [ ] **Step 2:** re-read it as a Postgres reviewer: lock order, no function replaced, grants, `search_path`. Commit `supabase/migrations/20261108100000_phone_signin.sql` — "Add phone sign-in tables and limit functions".
- [ ] **Step 3:** (Task 7 asks the owner to run it; nothing else depends on it until then, and the code treats a missing table as feature-off — see Task 3.)

---

### Task 3: Server modules

**Files:** Create `lib/sms.ts`, `lib/sms-data.ts`, `lib/phone-auth.ts`; Modify `lib/users.ts`

**Interfaces:**
- Consumes: Task 1 helpers; Task 2 SQL functions; `supabaseAdmin` from `lib/supabase/admin.ts`.
- `lib/users.ts`: `AppUser.email: string | null` (and `UserRow.email`); add `phone: string | null` to `AppUser`/`UserRow`/`COLUMNS`; `findUserByPhone(phone: string): Promise<AppUser | null>`; `createPhoneUser(phone: string): Promise<AppUser>` (handles unique-violation by re-reading, like `createPasswordUser`). Fix every compile error from the nullable email (show `email ?? phone` where displayed; `toExistingAccount` unchanged).
- `lib/sms.ts`: `sendSms(phone: string, message: string, senderId: string): Promise<boolean>` — `POST https://app.text.lk/api/v3/sms/send`, `Authorization: Bearer ${process.env.TEXTLK_API_TOKEN}`, `Accept`/`Content-Type: application/json`, body `{ recipient, sender_id, type: "plain", message }`, `AbortSignal.timeout(8000)`; true only when HTTP ok and `body.status === "success"`; logs `console.error` with status only (never the token, never the message). `smsTokenSet(): boolean`.
- `lib/sms-data.ts`: `getSmsSettings(): Promise<SmsSettings>` (error or missing table → `{ enabled: false, senderId: "", dailyCap: 200 }`), `saveSmsSettings(value: SmsSettings): Promise<void>`, `countSentToday(): Promise<number>` (rows since Asia/Colombo midnight), `smsAvailable(): Promise<boolean>` = settings enabled && sender id set && token set.
- `lib/phone-auth.ts`: `type RequestResult = "sent" | "invalid_phone" | "unavailable" | "too_soon" | "hourly_limit" | "daily_cap" | "send_failed"`; `requestPhoneCode(rawPhone: string): Promise<RequestResult>` (normalize → `unavailable` if `!smsAvailable()` → `generateCode` → `request_phone_code` rpc with `hashCode(phone, code, AUTH_SECRET)` → on `'ok'` `sendSms`; if send fails call `cancel_phone_code` and return `send_failed`); `verifyPhoneCode(rawPhone: string, rawCode: string): Promise<AppUser | null>` (normalize, `isValidCodeInput`, `smsAvailable()`, rpc `verify_phone_code`, then `findUserByPhone` or `createPhoneUser`).

- [ ] **Step 1:** Make `users.ts` changes; `npx tsc --noEmit` → Expected: errors listing every place that assumed `email: string`; fix each (Task 4 lists known display spots). No new unit tests (I/O only; rules are tested in Task 1).
- [ ] **Step 2:** Write the three modules (`import "server-only"`). `AUTH_SECRET` missing → throw.
- [ ] **Step 3:** `npx tsc --noEmit && npm run lint && npm test` → Expected: green. Commit explicit paths — "Add SMS sending, phone code requests and phone users".

---

### Task 4: Auth.js provider and null-email display

**Files:** Modify `auth.ts`, `lib/auth-messages.ts`, `app/account/page.tsx`, `app/admin/customers/page.tsx`, `app/components/AccountNav.tsx`, `lib/payments-data.ts` (and any file `tsc` flags)

**Interfaces:**
- Produces: Credentials provider `id: "phone"` with credentials `{ phone, code }` whose `authorize` calls `verifyPhoneCode` and returns `{ id, email, name, image, role }`; the `jwt` callback sets `token.id/role` for `account?.provider === "phone"` the same as credentials (extend the existing `credentials` branch condition).
- Messages added to `AUTH_MESSAGES`: `invalidPhone`, `phoneCodeSent`? No: only `invalidPhone`, `codeInvalid`, `codeTooSoon`, `codeLimit`, `smsUnavailable`, `smsSendFailed`, each `{ si, en }` (short; Sinhala flagged for owner review in the PR).

- [ ] **Step 1:** Add provider + messages. Account page and customers list show `user.email ?? user.phone`; `AccountNav` uses `session.user.name ?? session.user.email ?? phone-less fallback` (a nameless phone user: show the account icon text "Account" via `L`).
- [ ] **Step 2:** `npx tsc --noEmit && npm run lint && npm test` → green. Commit — "Add phone sign-in provider and handle accounts without email".

---

### Task 5: Sign-in UI

**Files:** Modify `app/signin/page.tsx`, `app/signin/SignInForm.tsx`, `app/signin/actions.ts`

**Interfaces:**
- Produces: server action `requestPhoneCodeAction(phone: string): Promise<AuthMessage | null>` mapping `RequestResult` → message codes (`sent` → `null`; `unavailable` → `smsUnavailable`; `too_soon`/`hourly_limit`/`daily_cap` → `codeTooSoon`/`codeLimit`/`codeLimit`; `send_failed` → `smsSendFailed`; `invalid_phone` → `invalidPhone`). `SignInForm` gets prop `phoneEnabled: boolean`; page passes `await smsAvailable()`.
- Phone flow in the form: a third tab "Phone" (only when `phoneEnabled`); step 1 phone → action; step 2 six-digit code (`inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength=6`) → `signIn("phone", { phone, code, redirect: false })` then `window.location.assign(callbackUrl)`; failure → `codeInvalid`; a "Send again" button that re-calls step 1.

- [ ] **Step 1:** Read `node_modules/next/dist/docs/` guidance for server actions if unsure; implement. Page keeps working when the SMS tables don't exist (`smsAvailable` returns false).
- [ ] **Step 2:** `npx tsc --noEmit && npm run lint && npm test` → green. Commit — "Add the phone tab to sign in".

---

### Task 6: Admin SMS page

**Files:** Create `app/admin/sms/page.tsx`, `app/admin/sms/SmsSettingsForm.tsx`, `app/admin/sms/actions.ts`; Modify `app/admin/AdminTabs.tsx` (tab `sms` → `/admin/sms`, label "SMS")

**Interfaces:**
- `saveSmsSettingsAction(prev, formData)` — `await requireAdmin("/admin/sms")` first; `parseSmsSettings`; refuses `enabled` when `!smsTokenSet()` (error key `enabled`: "Set TEXTLK_API_TOKEN on the server first"); saves; `revalidatePath("/admin/sms")` and `/signin`. State type `{ errors: Record<string,string>; saved: boolean }` like `PaymentSettingsState`.
- Page shows: switch (default off), sender ID, daily cap, "Sent today N of cap", token status ("set" / "not set", never the value), a short note on cost (~Rs 1 per code) and how to set the env var.

- [ ] **Step 1:** Implement following `app/admin/payments/*` patterns. **Step 2:** `npx tsc --noEmit && npm run lint && npm test` → green. Commit — "Add the SMS admin page".

---

### Task 7: Docs, migration, verification, review

**Files:** Modify `CLAUDE.md`

- [ ] **Step 1:** Add a "Phone sign-in (Part 9)" bullet to `CLAUDE.md` (accounts, nullable email, OTP rules and where they live, daily cap, env var, admin page, migration state "run before deploy") and add `SmsSettingsForm` to the client component list; update the "Later" sentence (Part 9 done; gateway last). Commit — "Document phone sign-in".
- [ ] **Step 2:** Ask the owner to run `supabase/migrations/20261108100000_phone_signin.sql` in the SQL editor ("done"); then ask them to add `TEXTLK_API_TOKEN` to `.env.local` and Vercel (never paste it in chat). Stop until done.
- [ ] **Step 3:** `npm test`, `npm run lint`, `npm run build` → green; `/` and `/products/[id]` still static.
- [ ] **Step 4:** SQL checks (owner approves running them; use a fake number `0770000000`, clean up after): `request_phone_code` twice quickly → second `too_soon`; 5 wrong `verify_phone_code` then the right hash → `invalid`; `daily_cap` set to 1 → `daily_cap`. Then delete the test rows and restore `daily_cap` 200.
- [ ] **Step 5:** Browser, with the owner's real number and Text.lk topped up: admin turns SMS on (sender ID, cap); `/signin` shows Phone; real code arrives; sign-in works; account shows the number; wrong code fails; admin turns it off → tab gone. Clean up test user/OTP rows.
- [ ] **Step 6:** Final Opus whole-branch review (Postgres expert on the migration and functions; auth/SSRF/abuse focus), one fix pass for Critical/Important with tests, PR (body ends with the Claude Code line; migration is additive), then wait for the owner's "merge".
