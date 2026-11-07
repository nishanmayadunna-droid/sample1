# Store Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the owner chose native execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the shop's name, logo, colours and fonts admin settings (`/admin/branding`) so each shop owner can brand their own deployment without code changes, with no visible change for an untouched shop.

**Architecture:** One `store_brand` row read by `getBrand()` (defaults on any failure). A pure `lib/brand.ts` resolves a theme (preset, accent, overrides), enforces contrast, and emits validated CSS injected in the root layout. Names reach pages through props and server reads, and messages through a `brandName` argument.

**Tech Stack:** Next.js 16.4.3 (read `node_modules/next/dist/docs/` for metadata/fonts before touching layout), Tailwind v4 tokens in `globals.css`, `next/font/google`, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-21-store-branding-design.md`

## Global Constraints

- `getBrand()` never throws: defaults (today's Northbound) on any error, so the code is safe before the migration.
- The injected CSS contains only `#rrggbb` values that passed validation and ids from fixed lists; an invalid stored theme resolves to the preset.
- Contrast gate on save, light and dark: text/bg ≥ 7, muted/bg ≥ 4.5, panelInk/panel ≥ 7, panelMuted/panel ≥ 4.5, onAccent/accent ≥ 4.5, accent vs bg and vs surface ≥ 3.
- Logos: PNG/WebP/JPEG ≤ 1 MB (1,048,576 bytes), no SVG, bucket `brand-assets`, name `<epoch>-<slot>.<ext>`.
- Name ≤ 40, short name ≤ 24, sender name ≤ 24; HTML emails use `escapeHtml`; owner alerts stay printable ASCII (fallback `Shop`).
- Every admin action starts with `await requireAdmin(...)`; saves call `revalidatePath("/", "layout")`; the migration is additive and run by the executor with `apply_migration` (the owner approved running SQL).
- No new runtime dependency; Sinhala copy needs the owner's review; commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; branch `feat/store-branding`, fast-forward merge to local `main`, then push (the owner asked for it).

## Review Focus

1. A light accent (e.g. `#f5e960`) must be refused in light and in dark with a code, never saved or "fixed" (Task 1).
2. A garbage `theme_overrides` row or an unknown `theme_id` must give the preset, never reach the CSS (Task 1, 2).
3. A name with `<b>` or `"` in an HTML email, a Sinhala sender name in an owner alert (Task 5).
4. A leftover `text-white` on a `bg-blaze` element after the sweep (Task 3).
5. A 40-character name in the mobile header, and no logo uploaded (wordmark) (Task 3).

---

## Task 1: Pure brand core (`lib/brand.ts`, `lib/brand-presets.ts`)

**Files:** Create `lib/brand.ts`, `lib/brand-presets.ts`, `lib/brand.test.ts`.

**Interfaces — Produces:** `type ThemeTokens = {bg, surface, text, muted, line, accent, panel, panelInk, panelMuted: string}`; `type Theme = {light: ThemeTokens & {onAccent: string}; dark: ThemeTokens & {onAccent: string}}`; `type Brand = {name, shortName, senderName, taglineSi, taglineEn, seoDescription: string; logoPath, logoDarkPath, faviconPath, shareImagePath: string | null; themeId: string; accent: string | null; themeOverrides: {light?: Partial<ThemeTokens>; dark?: Partial<ThemeTokens>}; fontPair: string}`; `DEFAULT_BRAND`; `PRESETS: Record<id, Theme>` (6: northbound, paper, ocean, forest, rose, midnight; northbound = the current `globals.css` values exactly); `FONT_PAIRS: Record<id, {label, displayCase: "uppercase"|"none", tracking: string}>` (northbound, classic, friendly, modern, editorial); `parseBrandRow(row: unknown): Brand`; `contrastRatio(a: string, b: string): number`; `pickOnAccent(accent: string): string`; `resolveTheme(brand: Brand): Theme`; `checkTheme(theme: Theme): string[]` (failed rule codes like `light_text_bg`); `themeCss(theme: Theme): string`; `isHex(v: unknown): v is string`; `wordmark(brand): string`; `senderName(brand, opts: {ascii: boolean}): string`; `validateBrandForm(fd: FormData): {ok: true; value: BrandRow} | {ok: false; errors: string[]}` and `isBrandImage(type: string, size: number): boolean`, `isValidBrandPath(path: string): boolean`.

- [ ] **Step 1: Failing tests** in `lib/brand.test.ts`: `contrastRatio("#000000","#ffffff")` is 21 and `("#777777","#777777")` is 1; every preset has `checkTheme(resolveTheme({...DEFAULT_BRAND, themeId: id})) = []`; `resolveTheme(DEFAULT_BRAND).light.accent === "#cb4a1c"` and `.light.bg === "#e7e7e0"` (today's values); a brand with `accent: "#f5e960"` makes `checkTheme` return a code containing `accent`; `themeCss(theme)` output matches `/^[\s\S]*$/` and every `#` token in it matches `#[0-9a-f]{6}`, and a theme override of `"#fff;}body{display:none"` is dropped (never appears); `parseBrandRow({theme_id:"nope", theme_overrides: "junk", font_pair: "x", accent: "red"})` equals `DEFAULT_BRAND` on those fields; `pickOnAccent("#cb4a1c")` is `#ffffff` and `pickOnAccent("#f5e960")` is a near-black; `senderName(brand with Sinhala sender, {ascii: true})` is `"Shop"`; `validateBrandForm` refuses a 41-character name and a bad hex with codes; `isBrandImage("image/svg+xml", 1)` false, `("image/png", 1048577)` false, `("image/webp", 1048576)` true; `isValidBrandPath("1700000000000-logo.png")` true and `("../x.png")` false.
- [ ] **Step 2:** Run `npx vitest run lib/brand.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the signatures above. Presets other than northbound: pick token sets that pass the gate in both modes (the test is the judge); `themeCss` emits `:root{...}` for light and `@media (prefers-color-scheme: dark){:root{...}}` with `--bg --surface --text --muted --line --accent --panel --panel-ink --panel-muted --on-accent`; `line` = the text colour at alpha 0.16 as `rgba(r,g,b,0.16)`.
- [ ] **Step 4:** Run the file — Expected: PASS. **Step 5:** Commit `feat: store brand core`.

## Task 2: Migration and reader

**Files:** Create `supabase/migrations/20261121100000_store_brand.sql`, `lib/brand-data.ts`.

**Interfaces — Consumes:** Task 1. **Produces:** `getBrand(): Promise<Brand>` (`cache()`, cookie-less, defaults on error), `getBrandName(): Promise<string>`, `getSenderName(opts?: {ascii?: boolean}): Promise<string>`, `brandAssetUrl(path: string): string`.

- [ ] **Step 1:** Write the migration to the spec's Data section (one row, public SELECT, no write grants, length/hex/path/id checks, bucket `brand-assets` public 1 MB png/jpeg/webp, seed row from today's footer text and Northbound values). **Step 2:** Apply it with `apply_migration` (project `dtytkwxlpvkervhkhcpu`), then verify with read-only `list_tables` (`store_brand` exists, RLS on, 1 row) and `get_advisors` security (INFO only). **Step 3:** Implement `lib/brand-data.ts` following `lib/store-contact-data.ts`. **Step 4:** `npx tsc --noEmit`. **Step 5:** Commit.

## Task 3: Layout, theme, fonts, header, footer, `text-onaccent` sweep

**Files:** Modify `app/layout.tsx`, `app/globals.css`, `app/components/Header.tsx`, `app/components/Footer.tsx`, `app/opengraph-image.tsx`; create `app/components/ThemeStyle.tsx`, `app/components/BrandLogo.tsx`, `lib/brand-scan.test.ts`; modify every file where `text-white` shares a class string with `bg-blaze` (find with a repository search).

**Interfaces — Consumes:** `getBrand`, `themeCss`, `resolveTheme`, `FONT_PAIRS`, `wordmark`, `brandAssetUrl`. **Produces:** `<BrandLogo brand />` (logo, dark logo through `<picture>` with `media="(prefers-color-scheme: dark)"`, or the wordmark in the display font; `alt` = name; truncates), `<ThemeStyle css />`, Tailwind colour `onaccent` (`--on-accent`).

- [ ] **Step 1: Failing test** `lib/brand-scan.test.ts`: read every `.tsx` under `app/` and assert no single `className` string contains both `bg-blaze` and `text-white` (list offending files in the message). Run — Expected: FAIL listing the files.
- [ ] **Step 2:** Change those to `text-onaccent`; add `--on-accent` fallback (`#ffffff`) and `@theme inline { --color-onaccent: var(--on-accent) }` to `globals.css`; run the scan — Expected: PASS.
- [ ] **Step 3:** Layout: add `getBrand()` to the parallel reads (`.catch(() => DEFAULT_BRAND)`); replace the static `metadata` with `generateMetadata` (title default/template from the name, description from `seoDescription`, Open Graph and Twitter, `icons` from `faviconPath` or the app default); render `<ThemeStyle>` in `<head>`; declare the five pairs' fonts with `next/font/google` (`preload: false` except the default), add all their `.variable` classes to `<html>` and set `--font-display-active`, `--font-body-active` and the display-case variables inline from `FONT_PAIRS`; `globals.css` uses these variables with the current Anton/Geist as fallbacks and `.display` takes `text-transform` from the variable. Check the Next docs for `generateMetadata` and font behaviour first.
- [ ] **Step 4:** Header and Footer take `brand` props and use `BrandLogo`/tagline; `opengraph-image.tsx` uses the share image or the wordmark on the theme colours.
- [ ] **Step 5:** `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` — Expected: all clean; with the seed row the pages are visually unchanged. **Step 6:** Commit.

## Task 4: Replace names in pages

**Files:** Modify `app/about/page.tsx`, `app/contact/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/returns/page.tsx`, `app/signin/page.tsx`, `app/forgot-password/page.tsx`, `app/admin/email/page.tsx`, `app/page.tsx`, `app/components/HomeHero.tsx`, `app/products/page.tsx`, `app/products/[id]/page.tsx`, `lib/seo.ts`.

- [ ] **Step 1: Failing test:** extend `lib/brand-scan.test.ts` — no `.tsx` under `app/` and no non-test `.ts` under `lib/` contains the literal `Northbound` or `NORTH` except an allowlist (`lib/brand.ts`, `lib/brand-presets.ts`, `lib/chat-defaults.ts` Sinhala copy comment, `app/globals.css`, `lib/seo.ts` default param). Run — FAIL listing the files.
- [ ] **Step 2:** Replace each occurrence with the brand name read through `getBrand()` (server pages) or props (client); `lib/seo.ts` functions take the name as an argument; update `lib/seo.test.ts` to pass it. **Step 3:** Run the scan, `tsc`, lint, tests, build — PASS. **Step 4:** Commit.

## Task 5: Message builders take `brandName`

**Files:** Modify `lib/notifications.ts`, `lib/otp.ts`, `lib/owner-alerts.ts`, `lib/push.ts`, `lib/email.ts` and their data callers (`*-data.ts`, `lib/phone-auth.ts`, `lib/sms.ts` paths) and tests.

**Interfaces — Consumes:** `getSenderName`. **Produces:** each builder gains a trailing `brandName: string` parameter used where "Northbound" was.

- [ ] **Step 1: Failing tests:** `buildMessage(...)` output contains the given name and not `Northbound` when another is passed; an HTML email template with name `<b>x</b>` contains `&lt;b&gt;` and not `<b>x</b>`; `buildOwnerMessage` with brand name `කඩේ` outputs printable ASCII only (uses `Shop`); `segmentCount` of a 24-character name message stays within 2 segments for the longest event. Run — FAIL.
- [ ] **Step 2:** Implement; callers pass `await getSenderName()` (`{ascii: true}` for owner alerts). **Step 3:** Full test run, `tsc`, lint — PASS. **Step 4:** Commit.

## Task 6: Admin `/admin/branding`

**Files:** Create `app/admin/branding/{page.tsx,actions.ts,BrandForm.tsx,LogoUpload.tsx,ThemePreview.tsx}`, `lib/admin-brand.ts`; modify `app/admin/AdminTabs.tsx` (add `branding`).

**Interfaces — Consumes:** Task 1 and 2. **Produces:** actions `saveBrandAction(prev, fd)`, `requestBrandUpload(slot: "logo"|"logoDark"|"favicon"|"share", type: string, size: number)`, `saveBrandImageAction(slot, path: string | null)`; `lib/admin-brand.ts` (`saveBrand`, `createBrandUpload`, `brandImageExists`, `setBrandImagePath`, `deleteBrandFile`).

- [ ] **Step 1: Failing tests** (pure, in `lib/brand.test.ts`): `validateBrandForm` with a form whose resolved theme fails the gate returns `{ok: false}` with the failing rule codes, and with a valid preset/accent/overrides returns the row; unknown `font_pair` refused; `overrides` fields that are not hex are refused.
- [ ] **Step 2:** Make them pass; implement the admin files following `app/admin/chat` (each action `requireAdmin` first, logo type/size/path/existence checks, old file deleted best effort, one transaction save, `revalidatePath("/", "layout")`, error codes mapped to messages). The preview renders a header and product card under a scoped `<style>` from `themeCss` of the form's current values with the contrast ratios shown.
- [ ] **Step 3:** `tsc`, lint, tests, build. **Step 4:** Commit.

## Task 7: Docs, review, merge, push

- [ ] **Step 1:** CLAUDE.md "Store branding" paragraph (data, `getBrand` fallback, theme gate, fonts, `onaccent` rule and its scan test, brandName in builders, what is not built, migration state) and a launch-checklist entry; fix any CLAUDE.md text that says the look or name is fixed.
- [ ] **Step 2:** `tsc`, lint, full tests, build — all clean.
- [ ] **Step 3:** One fresh reviewer (subagent, most capable model) reads the branch diff against the spec's Constraints and this plan's Review Focus; fix Critical and Important findings test-first in one pass; list minors as deferred.
- [ ] **Step 4:** Fast-forward merge `feat/store-branding` into local `main` and push; report what could not be checked (the admin page and each theme in the browser need the owner signed in).
