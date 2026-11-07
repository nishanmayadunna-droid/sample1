# Store branding: name, logo, colours and fonts as admin settings

## Understanding

This project is a SaaS product that many shop owners will run (see CLAUDE.md, "This is a SaaS product"). The chosen model is **one deployment per shop** (each customer gets their own Vercel and Supabase project), not a multi-tenant app. So everything about a shop's identity must be an admin setting and not code: the shop's name, its logo, its colours and its fonts. Today "Northbound" appears about 68 times in 21 files (header logo, page titles, share image, emails, SMS, push, policy pages) and the look is fixed in `app/globals.css`.

Done means: an owner opens `/admin/branding`, changes the name, logo, colours and font pair, saves, and the whole storefront (pages, share cards, favicon, emails, SMS, push) uses them, with no code change. A shop that never touches the page looks **exactly** as it does today.

Assumptions: the seeded home-page, About and Hero copy and pictures stay Northbound-flavoured content (a page content editor is a separate feature); only the **name** inside them follows the brand. Currency and country details (Rs/LKR, Sri Lankan districts, +94 phones) and adding languages are separate later sub-projects. Dark mode stays `prefers-color-scheme`. The seam for a future multi-tenant version is one function, `getBrand()`.

## Constraints

- **Never breaks a page.** `getBrand()` falls back to the built-in Northbound defaults on any read error or a missing table, so deploying the code before the migration is safe.
- **No CSS or HTML injection.** The injected `<style>` contains only `#rrggbb` values that passed validation and font-pair ids from a fixed list. A stored theme that fails validation resolves to the preset, never to the raw value.
- **Contrast is a hard gate on save** (the save is refused with a plain explanation, nothing is silently adjusted): for light and dark each: text/bg ≥ 7:1, muted/bg ≥ 4.5:1, panelInk/panel ≥ 7:1, panelMuted/panel ≥ 4.5:1, onAccent/accent ≥ 4.5:1, accent against bg and against surface ≥ 3:1.
- **Uploads:** PNG, WebP or JPEG, at most 1 MB, **no SVG**, public bucket `brand-assets`, name `<epoch>-<slot>.<ext>`, path regex and existence checked before saving, old file deleted best effort.
- **Names are plain text:** full name ≤ 40 characters, short name ≤ 24, sender name ≤ 24. HTML emails pass the name through `escapeHtml`; JSON-LD goes through `jsonLdScript`; React escapes it elsewhere.
- **Owner alerts stay printable ASCII** (a Sinhala name would raise the SMS cost): a sender name that is not printable ASCII falls back to `Shop` there. The Text.lk sender ID (`/admin/sms`) is a different setting and does not change.
- Every admin action starts with `await requireAdmin(...)`; the migration is additive; saving revalidates the whole layout.
- No Framer Motion or new runtime dependency; fonts come from `next/font/google`.

## Data (`20261121100000_store_brand.sql`)

`store_brand` (one row, **public SELECT**, writes via the secret key): `name` (default `Northbound`), `short_name`, `sender_name` (empty means use `short_name`), `tagline_si`, `tagline_en` (seeded from the current footer text), `seo_description`, `logo_path`, `logo_dark_path`, `favicon_path`, `share_image_path` (all nullable), `theme_id` (default `northbound`), `accent` (nullable: empty means the preset's accent), `theme_overrides` jsonb (default `{}`: `{light?: {token: hex}, dark?: {token: hex}}`), `font_pair` (default `northbound`), `updated_at`; check constraints on lengths, the hex pattern, the path pattern and the allowed `theme_id` and `font_pair` values. Public bucket `brand-assets` (1 MB, PNG/WebP/JPEG). The seed row equals today's look.

## Core (`lib/brand.ts`, pure and tested)

- Types `Brand`, `BrandTheme` (the 9 tokens `bg surface text muted line accent panel panelInk panelMuted` plus derived `onAccent`, for light and dark), `FontPair`.
- `DEFAULT_BRAND` (Northbound). `parseBrandRow(row)`: garbage or missing gives the defaults.
- `PRESETS` (6, each with light and dark token sets that pass the gate): `northbound` (the current values), `paper` (warm neutral), `ocean`, `forest`, `rose`, `midnight`. `FONT_PAIRS` (5): `northbound` (Anton and Geist, display in capitals), `classic` (Playfair Display and Inter), `friendly` (Poppins), `modern` (Space Grotesk and Inter), `editorial` (DM Serif Display and DM Sans). Geist Mono and Noto Sans Sinhala stay for every pair. Each pair says whether the display face is uppercase and its tracking.
- `contrastRatio(a, b)`, `pickOnAccent(accent)` (white or near-black, whichever contrasts more), `resolveTheme(brand)` (preset, then accent, then overrides), `checkTheme(theme)` returns the list of failed rules, `themeCss(theme)` returns the `:root` and dark `@media` CSS text (hex values only; `line` is the text colour at 16% alpha), `fontVars(pair)`, `wordmark(brand)`, `senderName(brand, { ascii })`, `validateBrandForm`.

`lib/brand-data.ts` (`server-only`): `getBrand()` (cookie-less client, `cache()`, defaults on any failure) and `getBrandName()` / `getSenderName()`.

## How the brand reaches the app

1. **Layout and metadata:** `app/layout.tsx` reads `getBrand()` in its existing parallel reads, builds `generateMetadata` (title template, description, Open Graph, Twitter, icons) from it, and renders `<style>{themeCss(...)}</style>` and the active font CSS variables on `<html>`. `app/opengraph-image.tsx` uses the share image or the wordmark. All pair font variables are declared with `preload: false` except the default pair, so only the chosen font files download.
2. **Components:** `Header` and `Footer` get the brand as props from the layout. The header shows the logo (a `<picture>` that switches to the dark logo under `prefers-color-scheme: dark`, `alt` = the name) or the wordmark text; a long name truncates. The footer shows the tagline.
3. **Pages:** about, contact, privacy, terms, returns, sign-in, forgot-password, product pages, `admin/email` and `lib/seo.ts` (JSON-LD organisation, product brand) read the name from `getBrand()`.
4. **Messages:** the pure builders in `lib/notifications.ts`, `lib/otp.ts`, `lib/owner-alerts.ts`, `lib/push.ts` and `lib/email.ts` take a `brandName` argument; their callers pass `await getSenderName()` (ASCII form for owner alerts). Existing tests are updated to pass it.
5. **Theme tokens:** `globals.css` keeps the Northbound values as the fallback, adds `--on-accent` and the Tailwind colour `onaccent`, and uses `--font-display-active`, `--font-body-active` and the display-case variables. Every `text-white` that sits on a `bg-blaze` surface becomes `text-onaccent`; a source-scan test fails if one is left.
6. **Maya chat:** the chat accent defaults to the shop accent unless the owner set one.

## Admin `/admin/branding`

A new "Branding" tab. Sections: **Identity** (name, short name, sender name, taglines, SEO description); **Logo** (logo, dark logo, favicon, share image, each uploaded straight to Storage through a signed URL and previewed on a light and a dark swatch; "use the default wordmark"); **Colours** (preset cards, accent picker with the automatic `onAccent`, a collapsed Advanced section with per-token, per-mode overrides, and a live preview of a header and a product card in the chosen theme with the contrast ratios shown); **Fonts** (the pair picker with a Sinhala and an English sample). One "Save branding" saves the identity, theme and font fields in one transaction after `checkTheme` and `validateBrandForm` pass; uploads save immediately. Errors are codes mapped to messages.

## Testing

Vitest: `contrastRatio` known values; every preset passes `checkTheme` in both modes; `themeCss` emits only valid hex and never a string from the input; a light accent that fails is refused in light and in dark; `pickOnAccent`; unknown `theme_id`/`font_pair` fall back; name length and printable-ASCII rules; `parseBrandRow` on garbage gives the defaults; `DEFAULT_BRAND` matches today's values; message builders with a brand name (HTML escaping, ASCII fallback for owner alerts, SMS segment counts); mascot-style upload rules for logos; and the `bg-blaze`/`text-white` source scan. **Not testable without the owner signing in:** the admin page and the live preview, light and dark rendering of each preset and font pair, logos on both backgrounds, and a long name in the mobile header (these are reported as not checked if they are not).

## Not built

A page content editor (hero, About copy, pictures), currency and country settings, adding languages, per-shop domains or multi-tenant data, more than the curated fonts or arbitrary font upload, a theme import/export, a setup wizard for new shops (a natural next sub-project), and a separate dark-mode favicon.

## Order of work

1. Pure core with tests (`lib/brand.ts`, presets, fonts, contrast, theme CSS).
2. Migration and the data reader (`getBrand`, defaults fallback).
3. Layout, theme injection, fonts, metadata, header and footer, `text-onaccent` sweep and its scan test.
4. Replace names in pages, policy pages and JSON-LD.
5. Message builders take `brandName`, tests updated.
6. Admin page, uploads and live preview.
7. CLAUDE.md section, launch checklist, review.
