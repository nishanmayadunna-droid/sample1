# Northbound launch checklist (Part 10)

Owner tasks are marked **[owner]**. Nothing here needs a code change.

## 1. Secrets
- [ ] **[owner]** Rotate the keys that leaked into earlier chats/logs: Supabase secret key (Dashboard -> Settings -> API keys), Google OAuth client secret (Google Cloud Console), and `AUTH_SECRET` (any new random 32+ character string). Changing `AUTH_SECRET` signs everyone out; that is fine before launch.
- [ ] **[owner]** Put the new values in `.env.local` and in Vercel (Project -> Settings -> Environment Variables), then redeploy. Never paste them in a chat.

## 2. Vercel environment variables (names only; checked on 2026-11-05)
Present: `SUPABASE_SECRET_KEY` (prod, preview), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (all), `AUTH_SECRET` (prod, preview), `AUTH_GOOGLE_SECRET` (prod, preview), `AUTH_GOOGLE_ID` (**production only**).
Missing / to add:
- [ ] `TEXTLK_API_TOKEN` (production) once the Text.lk account exists, for phone sign-in (PR #16).
- [ ] `AUTH_GOOGLE_ID` for **preview** too, if Google sign-in should work on preview deployments (optional).
- After the domain exists: add the production domain to Google's authorised redirect URIs (`https://<domain>/api/auth/callback/google`).

## 3. Domain
- [ ] **[owner]** Buy the domain now (`.lk` registration can take days; `.com` is instant). Needed for email (Part 11), Google sign-in and SEO. Point it at the Vercel project.

## 4. Database
- [ ] **[owner]** Confirm the hardening migrations ran: `20261103190000_reviews_column_grants.sql`, `20261104110000_orders_hardening.sql`, `20261105110000_advance_payments_hardening.sql`.
- [ ] **[owner]** Run `docs/launch/launch-reset.sql` once, shortly before launch (it refuses to run if more than 30 orders exist). Then delete the test slip files in Storage -> `payment-slips`.
- [ ] **[owner]** Optionally run `supabase/migrations/20261107110000_schedule_stale_cancel.sql` (auto-cancel schedule) after checking `/admin/orders?view=advance`.
- [ ] Real shop data: replace the 13 demo products and picsum photos, review the promises and the seeded `free-shipping` promotion, set the shipping fee in `/admin/settings`, bank details in `/admin/payments`.

## 5. Abuse limits (Vercel Firewall -> rate limit rules)
Suggested starting rules, per IP: `POST /signin` 10 per minute, `POST /api/auth/callback/*` 10 per minute, `POST /checkout` 10 per minute. Phone sign-in has its own SQL daily cap (`/admin/sms`).

## 6. Smoke test (after the domain is live)
Sign up, sign in (email and Google), add to cart, checkout (COD and, if on, advance), cancel, admin confirm/ship/deliver, points earned, review, sign out.

## 7. Search, analytics, monitoring (Part 15)
- [ ] Vercel dashboard -> project -> **Web Analytics: Enable** and **Speed Insights: Enable** (the code is already installed; nothing is collected until these are on).
- [ ] When the domain exists: set `NEXT_PUBLIC_SITE_URL=https://<domain>` in Vercel (Production) and redeploy, so canonical links, the sitemap and share cards use it.
- [ ] Google Search Console: add the site, submit `https://<domain>/sitemap.xml`, check the Product pages for rich-result errors.
- [ ] Free uptime monitor (e.g. UptimeRobot) on `https://<domain>/api/health` (expects HTTP 200 and `{"ok":true}`); alert to your phone/email.
- [ ] Optional: Vercel Firewall rate limit on `/api/health` (it is unauthenticated and reads the database).
- [ ] Share a product link in WhatsApp and Facebook and check the preview card (title, photo).
- [ ] Previews are never indexed (robots.txt disallows everything outside production, and Vercel adds a noindex header to preview URLs) -- only the production domain should appear in Google.
- [ ] Promote only production builds; to ship a preview, merge or redeploy (an API-promoted preview build would serve Disallow: / to Google).

## 8. Shop assistant (Maya)
- [ ] `/admin/chat`: check the answers (Sinhala copy needs your review), fill the trust notes with true statements only, upload your own mascot if you want one, then switch it on. Start with the free **Guided** engine.
- [ ] Optional AI engine: set `ANTHROPIC_API_KEY` in Vercel, pick the AI engine, set the limits (especially the whole-shop daily cap), and use the token guide at `/admin/chat/token-guide` to estimate the bill. Test real Sinhala questions before relying on it.

## 9. Branding (one shop per deployment)
- [ ] `/admin/branding`: set the shop name, short name, logo (and a dark-mode logo if the logo is dark), favicon and share image, pick a colour theme and font pair, then check the home page in light and dark mode and on a phone.
- [ ] Review the home page and About wording yourself: only the shop name follows the branding; the rest of that copy is still the sample text.
