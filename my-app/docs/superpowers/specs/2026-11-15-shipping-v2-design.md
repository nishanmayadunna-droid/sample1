# Shipping v2: product weight and weight-based fees (Part 20)

## Understanding

Part 12 charges one flat fee per zone. A heavy order costs the courier more than a single T-shirt, so each product gets a weight and each zone can optionally charge by the order's total weight. Assumptions: weights are optional; **if any item in an order has no weight, the zone's flat fee is charged** (never a guess); a zone with no bands behaves exactly as before; free-shipping promotions still win; the default fee still applies to districts in no zone; the cart, drawer and product page keep showing the default fee as an estimate; money in cents.

**Not built here: SMS delivery receipts.** They need Text.lk's delivery-report API (callback or status lookup), whose details are not in this repo or its docs. They are left for when the exact API is known.

## Constraints

- `place_order` is not changed: the fee is part of the total the server computes (`placeOrder` recomputes with `shippingFeeFor`, a changed fee returns `price_changed`), as in Part 12. The browser only previews.
- The migration is additive; `save_shipping_zones` keeps its signature, so a caller that omits bands stores flat zones. Apply the migration BEFORE deploying (the catalog select now includes `weight_grams`).
- Pure rules are unit-tested.

## Data (`20261115100000_shipping_v2.sql`)

- `products.weight_grams` (null or 1 to 100000).
- `shipping_zones.bands` (jsonb array of `{upToGrams, fee}` cents, ascending) and `extra_per_kg` (cents).
- `save_shipping_zones` stores `bands` and `extraPerKg` per zone.

## Rules (`lib/shipping.ts`)

`feeForWeight(zone, grams)`: no bands or unknown weight → flat fee; first band with `grams <= upToGrams` wins; above the last band, the last band's fee plus `extraPerKg` for every started kilogram. `orderWeightGrams(lines, products)`: sum of weight × quantity, or null when the cart is empty or any item has no weight. `shippingFeeFor(district, zones, default, weight?)` uses them. `validateZones` accepts up to 6 strictly ascending bands (1 to 100000 g, whole-rupee fees 0 to 100000) and an optional extra fee that needs bands.

## Admin

Product form: optional "Weight of one item in grams". `/admin/shipping`: each zone gets optional weight bands and a "Rs per extra kg" field.

## Out of scope

SMS delivery receipts (see above), volumetric weight, per-product shipping classes, courier rate APIs.
