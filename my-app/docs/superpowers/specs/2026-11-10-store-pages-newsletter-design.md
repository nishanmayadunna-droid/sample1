# Part 14: store pages + real newsletter — design

## Goal
Make the store trustworthy at launch: six information pages and a newsletter box that actually stores subscribers. Sending newsletters waits for a domain (Part 11). Firebase push is a separate later Part (14b).

## Understanding (confirmed with the owner)
- Pages: About, Contact, Privacy, Terms, Returns, Size guide. Bilingual (`<L si en>`), static/ISR, linked from the footer.
- Policy text is a draft written by Claude; it is not legal advice and needs the owner's review (Sinhala especially).
- Newsletter: "collect now, send later" — store emails, admin list + CSV export, working unsubscribe link ready for later campaigns. No sending, no double opt-in, no contact form.
- The owner's real facts (phone, WhatsApp, email, address, hours, return days) are entered in admin, not hard-coded.

## Design
**Store details:** new table `public.store_contact` (one row; `business_name`, `phone`, `whatsapp`, `email`, `address`, `hours`, `return_days` int default 7; public SELECT, writes via the secret key, no client grants beyond select). Read by `getStoreContact()` in `lib/store-contact-data.ts` with the cookie-less client (pages stay static, `revalidate = 60`); any error → defaults (all empty, `return_days` 7). Empty fields are hidden on the pages. Edited in a new "Store details" section at `/admin/settings` (`requireAdmin` first; pure `parseContactForm` validates: phone/WhatsApp digits with optional `+`, email shape, lengths). Storefront admin writes call `revalidatePath("/", "layout")` and the page paths.

**Pages:** `app/{about,contact,privacy,terms,returns,size-guide}/page.tsx` sharing a small `StorePage` layout component (eyebrow, display heading, prose width). Content: About (brand story from the footer tagline + COD/delivery promise); Contact (phone `tel:`, WhatsApp `https://wa.me/<digits>`, email `mailto:`, address, hours); Privacy (what is collected: account, phone, delivery details, orders, reviews, newsletter email; Supabase/Vercel/Text.lk as processors; no payment card data; how to ask for deletion via the contact details); Terms (cash on delivery, advance for new customers, prices in LKR, order cancellation while pending, stock/price errors, delivery times estimates); Returns (`return_days` days, unused with tags, how to request via contact details, advance/COD refund by arrangement); Size guide (generic cm tables for tops and bottoms with a "measure yourself" note, labelled as a guide). Footer "Help" column gets links to all six; the product page shows a "Size guide" link beside the size pills.

**Newsletter:** `public.newsletter_subscribers` (`id`, `email` lowercase unique, `source` text, `unsubscribe_token` text unique default random, `created_at`, `unsubscribed_at`), RLS on, no grants. `service_role`-only SQL functions: `subscribe_newsletter(p_email text, p_source text)` (idempotent; a re-subscribe after unsubscribing clears `unsubscribed_at`; refuses with `rate_limited` when more than 500 rows were created in 24 h) and `unsubscribe_newsletter(p_token text)`. The footer form calls a server action `subscribeNewsletter` that validates with the pure `validateEmail`, drops submissions with the honeypot field filled (pretending success), and returns a message code (`subscribed | invalid | busy | error`). `/unsubscribe?token=` shows a confirm button and posts a server action (GET never mutates). Admin `/admin/newsletter`: counts (active/unsubscribed), the latest 200 rows, a delete button per row, and a CSV export route handler (`requireAdmin` first, `text/csv`, CSV-injection-safe: cells starting with `= + - @` are prefixed with `'`).

## Out of scope
Sending campaigns, double opt-in, contact form, CMS-style editable policy text, push notifications.

## Migration
`20261110200000_store_pages_newsletter.sql` (both tables, two functions, RLS/grants). Additive; applied by Claude with the Supabase plugin before the code is deployed.

## Testing
Vitest for `parseContactForm`, contact links, `validateEmail`, CSV escaping/injection prefix, honeypot rule. Browser: pages render in both languages, empty contact fields hidden, subscribe twice → one row, unsubscribe works, CSV downloads.
