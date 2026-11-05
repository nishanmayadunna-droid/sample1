# Store Pages + Newsletter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six bilingual info pages with admin-editable contact details, and a newsletter box that stores subscribers with admin list/CSV/unsubscribe.

**Architecture:** Pure rules in `lib/store-contact.ts` and `lib/newsletter.ts` (tested). Two data layers (`lib/store-contact-data.ts` public cookie-less read + secret-key save; `lib/newsletter-data.ts` server-only, secret key). Private newsletter table with `service_role`-only SQL functions. Pages are static/ISR.

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase, Vitest, Tailwind v4 tokens from `app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-11-10-store-pages-newsletter-design.md`

## Global Constraints
- Next.js 16: read the relevant guide under `node_modules/next/dist/docs/` before new Next code (project rule); do not use remembered APIs.
- Customer-facing strings use `<L si="…" en="…" />` (`app/components/L.tsx`); admin text stays English; Sinhala copy is a draft for the owner's review.
- Pages must stay static/ISR: use the cookie-less client pattern (`lib/storefront.ts`), `export const revalidate = 60`; the root layout must not call `auth()`.
- Newsletter table private (RLS on, no policies, no grants); every admin action and route handler starts with `await requireAdmin(...)`; server actions return message codes, not text; mutations never happen on GET.
- Styling uses the design tokens (`bg-bg`, `text-ink`, `text-muted`, `border-line`, `text-blaze`, `.display`, `.eyebrow`, `.measure`); no default Tailwind palette colours.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus
- Subscribing the same email twice (any letter case, surrounding spaces) → one row; re-subscribe after unsubscribe clears `unsubscribed_at`.
- Honeypot filled → pretend success, store nothing; over 500 new rows in 24 h → `busy`.
- Unsubscribe link: GET must not mutate; unknown/empty token shows a neutral message.
- CSV export: cells beginning with `=`, `+`, `-`, `@` are neutralised; quotes/commas/newlines escaped; admin-only.
- Empty contact fields hide their lines; `wa.me` link has digits only; bad phone/email rejected in admin form.
- Pages render in both languages and stay static (build shows ○/● not ƒ for them).

---

### Task 1: Pure rules

**Files:**
- Create: `lib/store-contact.ts`, `lib/newsletter.ts`
- Test: `lib/store-contact.test.ts`, `lib/newsletter.test.ts`

**Interfaces (Produces):**
- `lib/store-contact.ts`: `export type StoreContact = { businessName: string; phone: string; whatsapp: string; email: string; address: string; hours: string; returnDays: number }`; `export const DEFAULT_STORE_CONTACT: StoreContact` (all `""`, `returnDays: 7`); `export function parseContactForm(fields: Record<string, string | undefined>): { ok: true; value: StoreContact } | { ok: false; errors: Record<string, string> }` (fields: `businessName` ≤ 80, `phone`/`whatsapp` optional, digits with optional leading `+`, spaces/dashes stripped, 9–15 digits, `email` optional and shaped like `a@b.c` ≤ 120, `address` ≤ 300, `hours` ≤ 120, `returnDays` integer 0–60 default 7 when blank); `export function telHref(phone: string): string | null`; `export function whatsappHref(number: string): string | null` (`https://wa.me/<digits only, no +>`; a number starting with `0` and 10 digits is treated as Sri Lankan and becomes `94…`); `export function mailHref(email: string): string | null`.
- `lib/newsletter.ts`: `export const NEWSLETTER_DAILY_CAP = 500`; `export function validateEmail(raw: string): { ok: true; email: string } | { ok: false }` (trim, lowercase, ≤ 254, single `@`, dotted domain, no spaces); `export function isHoneypotFilled(value: string | null | undefined): boolean`; `export function csvCell(value: string): string`; `export function toCsv(rows: { email: string; source: string; createdAt: string; unsubscribedAt: string | null }[]): string` (header `email,source,subscribed_at,unsubscribed_at`, CRLF line ends).

- [ ] **Step 1: Write the failing tests** (names and assertions): `parseContactForm` accepts `{phone:"071 234 5678", whatsapp:"+94 71-234-5678", email:"hi@shop.lk", returnDays:"14"}` and normalises phone to `0712345678` and whatsapp to `+94712345678`; rejects phone `"abc"`, email `"nope"`, `returnDays:"99"`, `businessName` of 81 chars; blank `returnDays` → 7. `whatsappHref("0712345678") === "https://wa.me/94712345678"`, `whatsappHref("+94712345678") === "https://wa.me/94712345678"`, `whatsappHref("") === null`; `telHref("0712345678") === "tel:0712345678"`; `mailHref("a@b.lk") === "mailto:a@b.lk"`. `validateEmail("  Foo@Bar.COM ")` → `foo@bar.com`; rejects `"a@b"`, `"a b@c.com"`, `"a@@b.com"`, `""`, 255-char address. `isHoneypotFilled("")`/`null`/`undefined` false, `"x"` true. `csvCell('=cmd')` → `'=cmd`; `csvCell('+1')`, `'-1'`, `'@x'` prefixed likewise; `csvCell('a,b')` → `"a,b"`; `csvCell('say "hi"')` → `"say ""hi"""`; `toCsv` header + one row with a newline-containing source stays one quoted cell.
- [ ] **Step 2: Run** `npx vitest run lib/store-contact.test.ts lib/newsletter.test.ts` — Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** both modules with the signatures above (pure, no imports from server-only code).
- [ ] **Step 4: Run** the two test files then `npm test` — Expected: PASS, whole suite green.
- [ ] **Step 5: Commit** `git add lib/store-contact.ts lib/store-contact.test.ts lib/newsletter.ts lib/newsletter.test.ts && git commit -m "Add store contact and newsletter rules"`

### Task 2: Migration and data layers

**Files:**
- Create: `supabase/migrations/20261110200000_store_pages_newsletter.sql`, `lib/store-contact-data.ts`, `lib/newsletter-data.ts`

**Interfaces:**
- Consumes: Task 1 exports; `supabase` cookie-less client as used in `lib/storefront.ts`; `supabaseAdmin` (`lib/supabase/admin.ts`).
- Produces:
  - `lib/store-contact-data.ts`: `getStoreContact(): Promise<StoreContact>` (React `cache()`, cookie-less client, any error → `DEFAULT_STORE_CONTACT`); `saveStoreContact(value: StoreContact): Promise<void>` (`import "server-only"` is NOT possible in a file that is also read by static pages only if split — keep the save in `lib/admin-store-contact.ts` with `import "server-only"`, and the read in `lib/store-contact-data.ts` without it, mirroring `lib/storefront.ts` vs `lib/admin-storefront.ts`).
  - `lib/newsletter-data.ts` (`server-only`): `subscribeEmail(email: string, source: string): Promise<"subscribed" | "busy" | "error">`; `unsubscribeByToken(token: string): Promise<"ok" | "not_found" | "error">`; `type Subscriber = { id: string; email: string; source: string; createdAt: string; unsubscribedAt: string | null }`; `listSubscribers(limit = 200): Promise<{ rows: Subscriber[]; active: number; unsubscribed: number }>`; `deleteSubscriber(id: string): Promise<void>`; `exportSubscribers(): Promise<Subscriber[]>` (all rows, capped 10,000).

- [ ] **Step 1: Write the migration.** `store_contact` (`id boolean primary key default true check (id)`, text columns default `''`, `return_days integer not null default 7 check (return_days between 0 and 60)`), one row inserted, RLS on, public SELECT policy for `anon, authenticated`, `revoke all … from anon, authenticated` then `grant select … to anon, authenticated` (follow how `20261102192254_create_storefront_settings.sql` does it exactly). `newsletter_subscribers` (`id uuid pk default gen_random_uuid()`, `email text not null`, `source text not null default 'footer'`, `unsubscribe_token text not null unique default encode(gen_random_bytes(18), 'hex')`, `created_at timestamptz default now()`, `unsubscribed_at timestamptz`), unique index on `lower(email)`, index on `created_at desc`, RLS on, `revoke all` from anon, authenticated. Functions (`security definer`, `set search_path = public`, `revoke all … from public, anon, authenticated; grant execute … to service_role`): `subscribe_newsletter(p_email text, p_source text) returns text` — lowercases/trims; if the email exists: clear `unsubscribed_at` and return `'subscribed'`; else if `(select count(*) from newsletter_subscribers where created_at > now() - interval '24 hours') >= 500` return `'busy'`; else insert and return `'subscribed'`; handle the unique-violation race by treating it as already subscribed. `unsubscribe_newsletter(p_token text) returns text` — set `unsubscribed_at = coalesce(unsubscribed_at, now())` where token matches; `'ok'` or `'not_found'`.
- [ ] **Step 2: Do NOT apply it yourself** (the controller applies with the Supabase plugin). Implement the data layers following the style of `lib/sms-data.ts` / `lib/storefront.ts` / `lib/admin-storefront.ts` (`rpc` calls, error codes only in logs, never log emails).
- [ ] **Step 3: Typecheck** `rm -rf .next/types .next/dev/types && npx tsc --noEmit`, `npm run lint`, `npm test` — Expected: clean/green.
- [ ] **Step 4: Commit** `git add supabase/migrations/20261110200000_store_pages_newsletter.sql lib/store-contact-data.ts lib/admin-store-contact.ts lib/newsletter-data.ts && git commit -m "Add store contact and newsletter storage"`

### Task 3: Newsletter UI

**Files:**
- Create: `app/newsletter-actions.ts`, `app/unsubscribe/page.tsx`, `app/unsubscribe/UnsubscribeButton.tsx`, `app/unsubscribe/actions.ts`, `app/admin/newsletter/{page.tsx,actions.ts,DeleteSubscriberButton.tsx}`, `app/admin/newsletter/export/route.ts`
- Modify: `app/components/Newsletter.tsx`, `app/admin/AdminTabs.tsx` (tab `newsletter`, label "Newsletter", after "Notifications")

**Interfaces:** Consumes Task 1–2 exports. Produces `subscribeNewsletter(formData: FormData): Promise<{ message: "subscribed" | "invalid" | "busy" | "error" }>`; `unsubscribeAction(token: string): Promise<{ message: "ok" | "not_found" | "error" }>`.

- [ ] **Step 1:** `subscribeNewsletter` (`"use server"`): read `email` and a honeypot field named `website`; if `isHoneypotFilled` return `{message:"subscribed"}` without storing; `validateEmail` → `invalid`; else `subscribeEmail(email, "footer")`.
- [ ] **Step 2:** Rework `Newsletter.tsx` to call the action (keep the existing markup and bilingual copy; add a visually hidden honeypot input `name="website"` with `tabIndex={-1}` `autoComplete="off"` `aria-hidden`; show bilingual messages for `invalid`/`busy`/`error`; disable the button while pending; success state unchanged). Update the copy only if it now lies (it promises "One email a month" — keep).
- [ ] **Step 3:** `/unsubscribe` page (server component, `searchParams` is a Promise in Next 16 — check the docs): no mutation on load; shows a bilingual confirm button (`UnsubscribeButton` client → `unsubscribeAction(token)`), neutral message when the token is missing/blank; `export const metadata` with `robots: { index: false }`.
- [ ] **Step 4:** Admin `/admin/newsletter` page (mirror `app/admin/sms/page.tsx` layout): active/unsubscribed counts, a table of the latest 200 (email, source, subscribed time in Asia/Colombo, status), `DeleteSubscriberButton` per row (action validates UUID, `requireAdmin` first), and an "Export CSV" link to `/admin/newsletter/export`. Route handler `GET` calls `await requireAdmin("/admin/newsletter")`, returns `toCsv(await exportSubscribers())` with `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="subscribers.csv"`, `Cache-Control: no-store`.
- [ ] **Step 5:** `npx tsc --noEmit`, `npm run lint`, `npm test`. Commit: `git add app && git commit -m "Add the newsletter signup, unsubscribe and admin list"` (check `git status` so only intended files are staged).

### Task 4: Store pages, footer, settings

**Files:**
- Create: `app/components/StorePage.tsx`, `app/{about,contact,privacy,terms,returns,size-guide}/page.tsx`, `app/admin/settings/ContactForm.tsx`
- Modify: `app/components/Footer.tsx` (Help column links), `app/admin/settings/{page.tsx,actions.ts}` (new "Store details" section + `saveContactAction`), product page size-guide link (`app/components/ProductPurchase.tsx`, beside the size pills)

**Interfaces:** Consumes `getStoreContact`, `parseContactForm`, `telHref`, `whatsappHref`, `mailHref`, `saveStoreContact`.

- [ ] **Step 1:** `StorePage` server component: props `{ eyebrow: ReactNode; title: ReactNode; children }`, container `mx-auto w-full max-w-3xl px-4 py-12 sm:px-6`, `.eyebrow`, `.display` heading, `.measure` rule, prose spacing `space-y-5 text-sm leading-relaxed`.
- [ ] **Step 2:** Pages per the spec's content bullets, all text via `<L>`; each exports `export const revalidate = 60` and `metadata` (English title, e.g. `title: "Returns"`; the title template adds "Northbound"). Contact/Returns/Privacy read `getStoreContact()`; hide empty lines; Returns uses `returnDays` (`returnDays === 0` → "no returns, except faulty items"); Contact shows `tel:`, WhatsApp, `mailto:` links only when `*Href` returns non-null. Privacy and Terms carry a visible "Last updated" date (2026-11-10) and the Sinhala copy is marked for review in the report, not on the page. Size guide: two tables (tops: XS–XXL chest/length in cm; bottoms: waist/hip/inseam), a "How to measure" list, and a note that fit can vary by product.
- [ ] **Step 3:** Footer Help column: add links About, Contact, Returns, Size guide, Privacy, Terms (bilingual labels) above the promises list.
- [ ] **Step 4:** Product page: a small "Size guide" `Link` to `/size-guide` next to the size pills in `ProductPurchase.tsx`, bilingual via `useLang()`/`tr` (client component) or `<L>`.
- [ ] **Step 5:** Admin settings: "Store details" form (mirror `ShippingForm.tsx`: onSubmit + `useTransition`, field errors from `parseContactForm`); `saveContactAction` begins with `await requireAdmin("/admin/settings")`, saves via `saveStoreContact`, then `revalidatePath("/", "layout")` and each of the six page paths.
- [ ] **Step 6:** `npx tsc --noEmit`, `npm run lint`, `npm test`; run `npm run build` once and confirm the new pages are static (○) or ISR (●), not dynamic (ƒ). Commit: `git add app && git commit -m "Add the store information pages"`.

### Task 5: Docs and live check

**Files:** Modify `CLAUDE.md` — a **Store pages and newsletter (Part 14)** bullet after the Notifications bullet (tables, functions, pages, honeypot + 500/day cap, CSV, unsubscribe on POST only, `getStoreContact` read vs admin save split, **Migration state:** `20261110200000_store_pages_newsletter.sql` applied before deploy, "newsletter sending waits for Part 11"); add new client components to the "Server vs client" list.

- [ ] **Step 1:** Edit `CLAUDE.md`, commit `git add CLAUDE.md && git commit -m "Document store pages and newsletter"`.
- [ ] **Step 2: Live check** (controller): apply the migration, then in the browser verify pages in both languages, footer links, empty contact lines hidden then shown after saving details in `/admin/settings`, subscribe twice (one row), honeypot ignored, `/unsubscribe` flow, CSV download. Restore contact details to empty afterwards if they were test values.
