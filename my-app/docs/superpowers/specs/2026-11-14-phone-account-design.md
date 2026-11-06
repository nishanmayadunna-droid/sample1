# Phone account: link and change a phone number (Part 19)

## Understanding

Phone sign-in (Part 9) never linked a phone to an email/Google account and never let anyone change a number. A signed-in customer can now add a phone to their account (so they can also sign in by SMS) or change the one they have, by confirming an SMS code sent to the **new** number. Assumptions: only while SMS sign-in is switched on; a phone belongs to one account; accounts are still never merged (a number already used by another account cannot be taken); changing an existing number is allowed once per 24 hours; no SMS to the old number; customer text in both languages.

## Constraints

- Reuses `request_phone_code` / `verify_phone_code` (same 60 s, 5 an hour, daily-cap and 5-guess limits as sign-in). The user id always comes from the session, never from the browser.
- No account-existence oracle: if another account owns the number, nothing is sent but the answer is still "sent", and confirming says the code is wrong, exactly like a wrong code.
- Additive migration (`20261114100000_phone_account.sql`): `users.phone_changed_at` and the `service_role`-only `set_user_phone(user, phone)` function, which locks the user row and returns one word: `linked`, `changed`, `same`, `phone_taken`, `too_soon`, `user_not_found` (a unique-violation race counts as `phone_taken`).
- Pure rules are unit-tested (`lib/phone-change.ts`).

## Flow

`/account` shows a Phone section (when SMS sign-in is on): current number or "Not added yet", button Add/Change. Step 1 `requestPhoneChangeAction(phone)` texts the code. Step 2 `confirmPhoneChangeAction(phone, code)` checks it (`checkPhoneCode`, extracted from `verifyPhoneCode`) and calls `set_user_phone`. Both actions start with `requireUser`.

## Out of scope

Merging two accounts, linking an email to a phone account, an SMS to the old number on change, removing a number.
