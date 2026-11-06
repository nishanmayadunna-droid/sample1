# Push notifications with Firebase Cloud Messaging (Part 23)

## Understanding

The owner gets the same four events as the owner SMS alerts (new order, new payment slip, low stock, a customer SMS that failed) as a push on their phone or browser, and customers get their own order events (placed or advance needed, shipped, delivered, cancelled, slip approved, slip rejected). Push is **in addition to** SMS and email, never instead. Built on FCM for the web now, shaped for a mobile app later (`platform` is `web | android | ios`, and an app gets a normal notification block instead of the data-only message the web uses).

The owner has not registered with Firebase yet, so it ships **OFF**: nothing is sent, and customers are not offered the button, until the keys are set and `/admin/push` switches it on. Assumptions: only the shop's admin accounts receive owner pushes (the role is read at send time, so a demotion applies at once); a person turns push on per device with a button and is never asked for permission before clicking; no push for the "advance needed" reminder beyond the `placed` toggle.

## Constraints

- **User id only from the session.** The register/unregister Server Actions use `requireUser` / `requireAdmin` and ignore any id from the browser; `unregister_push_token` deletes only the caller's own token; registration is limited to 10 an hour per user and 10 devices per user (the least recently seen is dropped).
- **Tokens are secrets.** Never in a URL, a log, the admin UI (only counts are shown) or an email. The browser keeps only a short SHA-256 fingerprint to notice token rotation. A token that is registered again by another user moves to that user (same browser, new person), so the previous person stops being notified.
- **No account-existence oracle.** Nothing here answers whether an address or account exists; the actions return one of `ok | invalid | too_many | error`.
- **Never throws, never double sends, fails closed.** `pushOwnerAlert` and `pushOrderEvent` swallow every error; each message claims a `push_log` row (`unique(kind, dedupe)`) before sending; a daily cap of 500 (a count that errors counts as over the cap); devices FCM reports `UNREGISTERED` (or `SENDER_ID_MISMATCH`) are deleted; message text and tokens are never logged (the log holds the event name and a masked recipient).
- All three new tables have RLS with no policies and no grants (secret key only). The migration is additive.
- No heavy dependency on the server: the sender uses `fetch` against FCM HTTP v1 with a Google service-account JWT signed by `node:crypto`. The browser needs the `firebase` web SDK (pinned `13.2.0`) to obtain a token; it is loaded with a dynamic `import()` only when someone clicks the button (or to refresh an already-enabled device), so ordinary pages do not ship it.

## Data (`20261118100000_push.sql`)

`push_settings` (one row, `enabled` false, `ev_owner_*` ×4 and `ev_customer_*` ×6 default true); `push_tokens` (`user_id`, `platform`, unique `token`, `last_seen_at`, `created_at`); `push_log` (`kind` owner|customer, `dedupe`, `event`, `recipient` masked, `status`); functions `register_push_token` (uses `rate_limit_hit` from the email migration) and `unregister_push_token`, `service_role` only.

## Pure rules (`lib/push.ts`, tested)

`parsePushSettings`, `customerPushEvent` (an advance order's `advance_due` shares the `placed` toggle), `isValidFcmToken`, `isPushPlatform`, `maskUserId`, `ownerPush` and `customerPush` (same wording as the SMS, prefix removed, body capped at 180 characters, link into the admin or the customer's order), `buildFcmMessage` (web: data-only with `Urgency: high`; app: a `notification` block), `classifyFcmError`, `normalizePrivateKey`, `serviceAccountJwt` (RS256; the test verifies the signature against the public key), the daily cap.

## Browser side

`public/firebase-messaging-sw.js` is a plain service worker with no Firebase SDK and no network access: it shows the push and opens the link on click, and refuses a link that is not on this shop's origin. `next.config.ts` serves it with `Cache-Control: no-cache` so a fix always reaches browsers. `PushToggle` asks for permission only on the click, handles denied (explains how to unblock), unsupported browsers, and iOS (push only works after Add to Home Screen, with a short hint), and refreshes the token on a visit when it changed or after a week. It appears on `/account` (customers), on `/admin/notifications` and on `/admin/push` (admin), and only while push is on with keys.

## Hooks

`alertOwner` (lib/owner-alerts-data.ts) calls `pushOwnerAlert` first, independent of the SMS switch; `alertLowStock` now also works when only push wants low-stock alerts; `notifyOrder` (lib/notifications-data.ts) calls `pushOrderEvent` right after `emailOrderEvent`, independent of both.

## Getting each value from the Firebase console (owner)

1. console.firebase.google.com > Add project (Google Analytics not needed).
2. Project settings (gear) > General > Your apps > **Web** (`</>`) > register the app. The config shown gives `apiKey` -> `NEXT_PUBLIC_FIREBASE_API_KEY`, `projectId` -> `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and `FIREBASE_PROJECT_ID`, `messagingSenderId` -> `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `appId` -> `NEXT_PUBLIC_FIREBASE_APP_ID` (`authDomain` is optional).
3. Project settings > **Cloud Messaging** > Web configuration > **Web Push certificates** > Generate key pair. The public key -> `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
4. Project settings > **Service accounts** > Generate new private key (downloads a JSON file; never commit it). `client_email` -> `FIREBASE_CLIENT_EMAIL`, `private_key` -> `FIREBASE_PRIVATE_KEY` (keep the quotes and the `\n` sequences). Make sure the **Firebase Cloud Messaging API (V1)** is enabled for the project (Cloud Messaging tab).
5. Put the `NEXT_PUBLIC_` values in `.env.local` and Vercel **before** building (they are baked in at build time), the three server values in `.env.local` and Vercel, redeploy, then switch push on at `/admin/push` and press "Enable alerts on this device".

## Not tested without keys

The Google token exchange, the FCM send, the real push event reaching the service worker (the payload shape FCM wraps a data-only web message in is handled defensively but unconfirmed), the permission prompt in a real browser, iOS Home Screen behaviour and token rotation. Everything else (rules, message text, JWT signing, error classification, settings, limits) is covered by unit tests. Test locally over HTTPS (`next dev --experimental-https`) with notifications allowed.

## Out of scope

A native mobile app, topics/segments, notification images and actions, a per-customer opt-out beyond turning the device off, retrying failed sends, delivery receipts.
