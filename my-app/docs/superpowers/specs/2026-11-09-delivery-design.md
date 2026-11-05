# Part 12: Delivery — design

Status: the owner chose zones (option B) and asked me to decide the rest by industry practice (no further questions). Courier is undecided, so everything is courier-agnostic.

## Goal
Shipping fee by delivery district through admin-managed zones; couriers and tracking on each order; a print page (packing slip / waybill) for the admin; tracking shown to the customer.

## Out of scope
Courier API/booking, automatic tracking updates, customer SMS/email on shipping (Part 13), weight-based fees, shop contact details on the slip (Part 14), bulk printing.

## Shipping fee by zone
- `public.shipping_zones` (`id`, `name`, `fee` cents ≥ 0, `districts text[]`, `sort_order`); RLS on, public SELECT (fees are public), writes via the secret key.
- The 25 districts of Sri Lanka are a constant in `lib/shipping.ts` (English + Sinhala names). A district may belong to at most one zone. The default fee is `store_settings.shipping_fee` (unchanged, edited in `/admin/settings`): it applies to a district that is in no zone, to an order with no district, and when zones can't be read. The migration seeds one zone, "Island-wide", with all 25 districts and the current default fee, so nothing changes until the admin edits zones.
- Pure rules (`lib/shipping.ts`): `DISTRICTS`, `isDistrict`, `shippingFeeFor(district, zones, defaultFee)`, `validateZones` (names 1–40 chars, fee whole rupees 0–100000, no district twice, only known districts, at most 10 zones).
- Checkout: a required **District** select (bilingual labels) beside the existing City field. `parseCheckoutDetails` gets `district` (must be a known district). The browser previews the fee with the same pure function; `placeOrder` re-reads the zones and passes `shippingFeeFor(...)` to `planOrder` as `shippingFee`, so a changed fee returns `price_changed` as today. Free-shipping promotions still win (they live in `summarizeCart`). `/cart` and the drawer keep showing the default fee labelled as an estimate; the exact fee appears at checkout.
- `orders.district` (nullable text) is stored by a second statement right after `place_order` (`setOrderDistrict`, idempotent). `place_order` is NOT replaced (no outage window). If that update fails the order is still correct (the total already includes the fee) and the admin sees the city.

## Couriers and tracking
- `public.couriers` (`id`, `name`, `tracking_url_template` nullable, `active`, `sort_order`); private (RLS, no policies, no grants). The template must be `https://…` and contain `{number}`; the link is the template with the URL-encoded tracking number.
- `orders` gets `courier_name`, `tracking_number`, `tracking_url` (all nullable snapshots, so later courier edits never rewrite old orders).
- Admin order page: a **Shipment** section for confirmed and shipped orders: pick a courier, enter the tracking number (3–40 chars, letters/digits/dashes), save; it is also editable later. Not required to mark an order shipped (own rider deliveries stay possible).
- Customer `/orders/[number]`: courier name, tracking number and a "Track your parcel" link when set.

## Print page
`/admin/orders/[number]/print` (admin only, `requireAdmin`): an A5/A6-friendly page with order number, customer name, phone, full address, district, the items (name, size, quantity), the note, and a prominent **Collect on delivery: Rs X** (the order total minus the advance paid; 0 collect for a fully prepaid order). A "Print" button (`window.print()`) and print CSS hide the admin chrome.

## Admin `/admin/shipping`
Tab "Shipping": zones (add, edit name/fee/districts, delete; selecting a district in one zone removes it from another) and couriers (name, tracking URL template, active). Every action starts with `requireAdmin`.

## Migration
`20261109100000_delivery.sql`: the two tables, the four `orders` columns, the seed zone. Additive; the running code ignores all of it, so applying it first breaks nothing.

## Verification
Unit tests for every pure rule and the changed `parseCheckoutDetails`/`planOrder`; tsc, lint, build (`/` and `/products/[id]` stay static; `/checkout` is already dynamic); browser: zone edit changes the checkout fee, a placed order shows district, shipment saved and shown to the customer, print page.
